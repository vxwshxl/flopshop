"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { adjustWallet, transferCredit, type WalletOwner } from "@/lib/server/wallet";
import type { Role, WalletTxnMethod, WalletTxnType } from "@/lib/types";

/** A wallet owner the admin can pick as a transfer recipient. */
export type WalletOwnerOption = {
  kind: "profile" | "customer";
  id: string;
  label: string;
  sublabel: string | null;
};

async function requireRole(roles: Role[]): Promise<{ id: string; role: Role } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (data?.role ?? "user") as Role;
  return roles.includes(role) ? { id: user.id, role } : null;
}

const ADJUST_TYPES: WalletTxnType[] = ["change", "topup", "withdrawal", "adjustment"];

/**
 * Admin adds (or deducts) store credit for a profile or walk-in customer.
 * `amount` is signed: + adds credit, − deducts it. A deduction may push the
 * balance below 0 so the shop can record what a customer owes (debt).
 * Used for the "no change at the counter" scenario and manual corrections.
 */
export async function adminAdjustWalletAction(
  owner: WalletOwner,
  amount: number,
  type: WalletTxnType,
  note?: string,
  method?: WalletTxnMethod | null
): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
  const actor = await requireRole(["admin"]);
  if (!actor) return { ok: false, error: "Not authorized." };

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt === 0) return { ok: false, error: "Enter a non-zero amount." };
  if (!ADJUST_TYPES.includes(type)) return { ok: false, error: "Invalid credit type." };

  const res = await adjustWallet({
    owner,
    amount: amt,
    type,
    method: method ?? null,
    actorId: actor.id,
    note,
    allowNegative: true,
  });
  if (!res.ok) return res;

  revalidatePath("/admin/customers");
  if ("profileId" in owner) revalidatePath(`/admin/users/${owner.profileId}`);
  return { ok: true, balance: res.balance };
}

/**
 * Admin moves store credit from one owner's wallet to another's. Records which
 * admin did it (actor) on both ledger legs. The source may go into debt.
 */
export async function adminTransferCreditAction(
  fromOwner: WalletOwner,
  toOwner: WalletOwner,
  amount: number,
  note?: string
): Promise<{ ok: true; fromBalance: number; toBalance: number } | { ok: false; error: string }> {
  const actor = await requireRole(["admin"]);
  if (!actor) return { ok: false, error: "Not authorized." };

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, error: "Enter an amount greater than 0." };

  const res = await transferCredit({
    fromOwner,
    toOwner,
    amount: amt,
    actorId: actor.id,
    note,
    allowNegative: true,
  });
  if (!res.ok) return res;

  revalidatePath("/admin/customers");
  if ("profileId" in fromOwner) revalidatePath(`/admin/users/${fromOwner.profileId}`);
  if ("profileId" in toOwner) revalidatePath(`/admin/users/${toOwner.profileId}`);
  return res;
}

/** Search login users + walk-in customers to pick a transfer recipient. */
export async function searchWalletOwnersAction(query: string): Promise<WalletOwnerOption[]> {
  const actor = await requireRole(["admin"]);
  if (!actor) return [];
  const q = query.trim();
  if (q.length < 2) return [];

  const admin = createAdminClient();
  const like = `%${q}%`;
  const [{ data: profiles }, { data: customers }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, email")
      .or(`full_name.ilike.${like},email.ilike.${like}`)
      .limit(6),
    admin.from("customers").select("id, name, phone").ilike("name", like).limit(6),
  ]);

  const out: WalletOwnerOption[] = [];
  for (const p of (profiles as { id: string; full_name: string | null; email: string | null }[] | null) ?? [])
    out.push({ kind: "profile", id: p.id, label: p.full_name ?? p.email ?? "User", sublabel: p.email });
  for (const c of (customers as { id: string; name: string; phone: string | null }[] | null) ?? [])
    out.push({ kind: "customer", id: c.id, label: c.name, sublabel: c.phone ? `${c.phone} · walk-in` : "walk-in" });
  return out;
}

/**
 * Approve a pending top-up request: credit the user's wallet and mark it
 * approved. Verified manually by the admin after receiving the cash/UPI.
 */
export async function approveTopupAction(
  requestId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireRole(["admin"]);
  if (!actor) return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("wallet_topup_requests")
    .select("id, profile_id, amount, method, status")
    .eq("id", requestId)
    .single();
  if (!req) return { ok: false, error: "Request not found." };
  if (req.status !== "pending") return { ok: false, error: "Already reviewed." };

  const credit = await adjustWallet({
    owner: { profileId: req.profile_id },
    amount: Number(req.amount),
    type: "topup",
    method: (req.method as WalletTxnMethod | null) ?? null,
    actorId: actor.id,
    note: `Top-up approved · ${String(req.method ?? "").toUpperCase()}`,
  });
  if (!credit.ok) return credit;

  const { error } = await admin
    .from("wallet_topup_requests")
    .update({ status: "approved", reviewed_by: actor.id, reviewed_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/wallet");
  return { ok: true };
}

/** Reject a pending top-up request (no money moves). */
export async function rejectTopupAction(
  requestId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireRole(["admin"]);
  if (!actor) return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("wallet_topup_requests")
    .update({ status: "rejected", reviewed_by: actor.id, reviewed_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/wallet");
  return { ok: true };
}
