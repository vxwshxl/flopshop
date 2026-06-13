"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { adjustWallet, type WalletOwner } from "@/lib/server/wallet";
import type { Role, WalletTxnType } from "@/lib/types";

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

const ADJUST_TYPES: WalletTxnType[] = ["change", "topup", "adjustment"];

/**
 * Admin adds (or deducts) store credit for a profile or walk-in customer.
 * `amount` is signed: + adds credit, − deducts it (a deduction can't overdraw).
 * Used for the "no change at the counter" scenario and manual corrections.
 */
export async function adminAdjustWalletAction(
  owner: WalletOwner,
  amount: number,
  type: WalletTxnType,
  note?: string
): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
  const actor = await requireRole(["admin"]);
  if (!actor) return { ok: false, error: "Not authorized." };

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt === 0) return { ok: false, error: "Enter a non-zero amount." };
  if (!ADJUST_TYPES.includes(type)) return { ok: false, error: "Invalid credit type." };

  const res = await adjustWallet({ owner, amount: amt, type, actorId: actor.id, note });
  if (!res.ok) return res;

  revalidatePath("/admin/customers");
  if ("profileId" in owner) revalidatePath(`/admin/users/${owner.profileId}`);
  return { ok: true, balance: res.balance };
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
    .select("id, profile_id, amount, status")
    .eq("id", requestId)
    .single();
  if (!req) return { ok: false, error: "Request not found." };
  if (req.status !== "pending") return { ok: false, error: "Already reviewed." };

  const credit = await adjustWallet({
    owner: { profileId: req.profile_id },
    amount: Number(req.amount),
    type: "topup",
    actorId: actor.id,
    note: "Top-up approved",
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
