import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { Wallet, WalletTransaction, WalletTxnType } from "@/lib/types";

/** Exactly one owner identifies a wallet. */
export type WalletOwner = { profileId: string } | { customerId: string };

function ownerArgs(owner: WalletOwner) {
  return "profileId" in owner
    ? { p_profile_id: owner.profileId, p_customer_id: null }
    : { p_profile_id: null, p_customer_id: owner.customerId };
}

/** Resolve (creating on first touch) the wallet id for an owner. */
export async function getOrCreateWalletId(owner: WalletOwner): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("wallet_get_or_create", ownerArgs(owner));
  if (error) return null;
  return (data as string | null) ?? null;
}

/** The wallet row for an owner, or null when it doesn't exist yet. */
export async function getWallet(owner: WalletOwner): Promise<Wallet | null> {
  const admin = createAdminClient();
  const col = "profileId" in owner ? "profile_id" : "customer_id";
  const val = "profileId" in owner ? owner.profileId : owner.customerId;
  const { data } = await admin.from("wallets").select("*").eq(col, val).maybeSingle();
  return (data as Wallet | null) ?? null;
}

/** Current balance for an owner (0 when no wallet exists yet). */
export async function getWalletBalance(owner: WalletOwner): Promise<number> {
  const w = await getWallet(owner);
  return w ? Number(w.balance) : 0;
}

/** Wallet + its most recent transactions (newest first). */
export async function getWalletWithTransactions(
  owner: WalletOwner,
  limit = 20
): Promise<{ wallet: Wallet | null; transactions: WalletTransaction[] }> {
  const wallet = await getWallet(owner);
  if (!wallet) return { wallet: null, transactions: [] };
  const admin = createAdminClient();
  const { data } = await admin
    .from("wallet_transactions")
    .select("*")
    .eq("wallet_id", wallet.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { wallet, transactions: (data as WalletTransaction[] | null) ?? [] };
}

type AdjustResult = { ok: true; balance: number } | { ok: false; error: string };

/**
 * Move money on a wallet via the atomic `wallet_adjust` RPC. `amount` is signed
 * (+ credit, − debit); a debit that would overdraw the wallet is rejected.
 * Resolves (creating if needed) the owner's wallet first.
 */
export async function adjustWallet(params: {
  owner: WalletOwner;
  amount: number;
  type: WalletTxnType;
  actorId?: string | null;
  orderId?: string | null;
  note?: string | null;
  /** Let the balance go below 0 (customer owes the shop). Admin moves only. */
  allowNegative?: boolean;
}): Promise<AdjustResult> {
  const walletId = await getOrCreateWalletId(params.owner);
  if (!walletId) return { ok: false, error: "Could not resolve wallet." };
  return adjustWalletById({ ...params, walletId });
}

/**
 * Make the *net* of an order's manual settlement entries (type `adjustment`,
 * tagged with the order id) equal `targetNet` — signed: + parks store credit for
 * the customer, − records a debt they owe the shop. Only the delta vs whatever
 * was already applied is moved, so repeated saves (editing "amount paid", or
 * flipping the payment method) never double-count. The balance is allowed to go
 * negative. Returns `skipped` when nothing needed to change.
 */
export async function reconcileOrderAdjustment(params: {
  owner: WalletOwner;
  orderId: string;
  targetNet: number;
  actorId?: string | null;
  note?: string | null;
}): Promise<AdjustResult | { ok: true; balance: number; skipped: true }> {
  const walletId = await getOrCreateWalletId(params.owner);
  if (!walletId) return { ok: false, error: "Could not resolve wallet." };

  const admin = createAdminClient();
  const { data: txns } = await admin
    .from("wallet_transactions")
    .select("amount")
    .eq("wallet_id", walletId)
    .eq("order_id", params.orderId)
    .eq("type", "adjustment");
  const applied = ((txns as { amount: number }[] | null) ?? []).reduce((s, t) => s + Number(t.amount), 0);

  const delta = Number(params.targetNet) - applied;
  if (Math.abs(delta) < 0.005) return { ok: true, balance: 0, skipped: true };

  return adjustWalletById({
    walletId,
    amount: delta,
    type: "adjustment",
    orderId: params.orderId,
    actorId: params.actorId,
    note: params.note ?? "Order payment reconciliation",
    allowNegative: true,
  });
}

/**
 * Reverse the credit charged for an order (e.g. when it's cancelled). Finds the
 * `order_payment` debits for the order, and if no `refund` was already recorded,
 * credits the same wallet back. No-op when the order wasn't paid by credit.
 */
export async function refundOrderCredit(
  orderId: string,
  actorId?: string | null
): Promise<AdjustResult | { ok: true; balance: number; skipped: true }> {
  const admin = createAdminClient();
  const { data: txns } = await admin
    .from("wallet_transactions")
    .select("wallet_id, amount, type")
    .eq("order_id", orderId);
  const rows = (txns as { wallet_id: string; amount: number; type: string }[] | null) ?? [];

  const alreadyRefunded = rows.some((t) => t.type === "refund");
  const payments = rows.filter((t) => t.type === "order_payment");
  if (alreadyRefunded || payments.length === 0) {
    return { ok: true, balance: 0, skipped: true };
  }
  // All order_payment rows for one order share a wallet; sum the (negative) debits.
  const walletId = payments[0].wallet_id;
  const refundAmount = Math.abs(payments.reduce((s, t) => s + Number(t.amount), 0));
  if (refundAmount <= 0) return { ok: true, balance: 0, skipped: true };

  return adjustWalletById({
    walletId,
    amount: refundAmount,
    type: "refund",
    orderId,
    actorId,
    note: "Order cancelled — credit refunded",
  });
}

/** Same as `adjustWallet` but against a known wallet id. */
export async function adjustWalletById(params: {
  walletId: string;
  amount: number;
  type: WalletTxnType;
  actorId?: string | null;
  orderId?: string | null;
  note?: string | null;
  /** Let the balance go below 0 (customer owes the shop). Admin moves only. */
  allowNegative?: boolean;
}): Promise<AdjustResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("wallet_adjust", {
    p_wallet_id: params.walletId,
    p_amount: params.amount,
    p_type: params.type,
    p_order_id: params.orderId ?? null,
    p_note: params.note ?? null,
    p_actor: params.actorId ?? null,
    p_allow_negative: params.allowNegative ?? false,
  });
  if (error) return { ok: false, error: error.message };
  const res = data as { ok: boolean; error?: string; balance?: number };
  if (!res?.ok) return { ok: false, error: res?.error ?? "Wallet update failed." };
  return { ok: true, balance: Number(res.balance ?? 0) };
}
