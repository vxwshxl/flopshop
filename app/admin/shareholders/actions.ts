"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { shareholderShare, type ProfitOrder } from "@/lib/utils/shareholders";
import type { Role, Shareholder } from "@/lib/types";

async function currentUser(): Promise<{ id: string; isAdmin: boolean } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return { id: user.id, isAdmin: ((data?.role ?? "user") as Role) === "admin" };
}

async function requireAdmin(): Promise<{ id: string } | null> {
  const u = await currentUser();
  return u?.isAdmin ? { id: u.id } : null;
}

const ORDER_SELECT =
  "created_at, status, subtotal, admin_delivery_earning, order_items(quantity, cost_price)";

/**
 * Settle a single shareholder at their own time: snapshot the profit accrued to
 * them since their last settlement (floored by their `profit_from`), record a
 * pending payout with `settled_through = now()`, and reset their balance. Each
 * shareholder is independent, so others are unaffected.
 */
export async function settleShareholderAction(
  shareholderId: string,
  note?: string
): Promise<{ ok: true; amount: number; name: string } | { ok: false; error: string }> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();

  const { data: holder, error: hErr } = await admin
    .from("shareholders")
    .select("*")
    .eq("id", shareholderId)
    .single();
  if (hErr || !holder) return { ok: false, error: "Shareholder not found." };
  const sh = holder as Shareholder;

  // This shareholder's own last cutoff.
  const { data: last } = await admin
    .from("shareholder_settlements")
    .select("settled_through")
    .eq("shareholder_id", shareholderId)
    .order("settled_through", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sinceIso = (last as { settled_through: string } | null)?.settled_through ?? null;

  const cutoff = new Date().toISOString();
  const { data: orders, error } = await admin
    .from("orders")
    .select(ORDER_SELECT)
    .not("status", "eq", "cancelled")
    .lte("created_at", cutoff);
  if (error) return { ok: false, error: error.message };

  const { base, amount } = shareholderShare((orders as unknown as ProfitOrder[]) ?? [], sh, sinceIso);
  if (amount <= 0) return { ok: false, error: `Nothing outstanding to settle for ${sh.name}.` };

  const { error: insErr } = await admin.from("shareholder_settlements").insert({
    shareholder_id: sh.id,
    name: sh.name,
    type: sh.type,
    share_percent: Number(sh.share_percent),
    profit_base: base,
    amount,
    settled_through: cutoff,
    status: "pending",
    note: note?.trim() || null,
    created_by: actor.id,
  });
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/admin/shareholders");
  revalidatePath("/admin/reports");
  revalidatePath("/profile");
  return { ok: true, amount, name: sh.name };
}

/**
 * Confirm a settlement as received. Allowed for an admin, or for the shareholder
 * whose linked account this settlement belongs to.
 */
export async function confirmSettlementAction(
  settlementId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await currentUser();
  if (!me) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("shareholder_settlements")
    .select("id, status, shareholder:shareholders(profile_id)")
    .eq("id", settlementId)
    .single();
  if (error || !row) return { ok: false, error: "Settlement not found." };

  const ownerProfile = (row as unknown as { shareholder: { profile_id: string | null } | null })
    .shareholder?.profile_id;
  if (!me.isAdmin && ownerProfile !== me.id) {
    return { ok: false, error: "Not authorized." };
  }

  const { error: updErr } = await admin
    .from("shareholder_settlements")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", settlementId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/admin/shareholders");
  revalidatePath("/profile");
  return { ok: true };
}

/**
 * Reverse a settlement (admin): deleting it removes the holder's cutoff, so the
 * profit it covered flows back into that shareholder's outstanding balance.
 */
export async function deleteSettlementAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();
  const { error } = await admin.from("shareholder_settlements").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/shareholders");
  revalidatePath("/admin/reports");
  revalidatePath("/profile");
  return { ok: true };
}

function parsePercent(value: number | string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Number(n.toFixed(2));
}

/** Normalize a YYYY-MM-DD date input to a string or null. */
function parseDate(value?: string | null): string | null {
  const v = value?.trim();
  if (!v) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export async function addShareholderAction(input: {
  name: string;
  type?: string;
  share_percent: number | string;
  profit_from?: string | null;
  profile_id?: string | null;
}): Promise<{ ok: true; shareholder: Shareholder } | { ok: false; error: string }> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "Not authorized." };

  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name is required." };
  const share_percent = parsePercent(input.share_percent);
  if (share_percent === null) return { ok: false, error: "Share % must be between 0 and 100." };

  const admin = createAdminClient();
  const { count } = await admin.from("shareholders").select("id", { count: "exact", head: true });

  const { data, error } = await admin
    .from("shareholders")
    .insert({
      name,
      type: input.type?.trim() || null,
      share_percent,
      profit_from: parseDate(input.profit_from),
      profile_id: input.profile_id || null,
      sort_order: count ?? 0,
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/shareholders");
  revalidatePath("/admin/reports");
  return { ok: true, shareholder: data as Shareholder };
}

export async function updateShareholderAction(input: {
  id: string;
  name: string;
  type?: string;
  share_percent: number | string;
  profit_from?: string | null;
  profile_id?: string | null;
  is_active: boolean;
}): Promise<{ ok: true; shareholder: Shareholder } | { ok: false; error: string }> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "Not authorized." };

  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name is required." };
  const share_percent = parsePercent(input.share_percent);
  if (share_percent === null) return { ok: false, error: "Share % must be between 0 and 100." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shareholders")
    .update({
      name,
      type: input.type?.trim() || null,
      share_percent,
      profit_from: parseDate(input.profit_from),
      profile_id: input.profile_id || null,
      is_active: input.is_active,
    })
    .eq("id", input.id)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/shareholders");
  revalidatePath("/admin/reports");
  revalidatePath("/profile");
  return { ok: true, shareholder: data as Shareholder };
}

export async function deleteShareholderAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();
  const { error } = await admin.from("shareholders").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/shareholders");
  revalidatePath("/admin/reports");
  return { ok: true };
}
