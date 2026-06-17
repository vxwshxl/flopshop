"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { computeProfitPool, splitPool, totalPercent, type ProfitOrder } from "@/lib/utils/shareholders";
import type { Role, Shareholder } from "@/lib/types";

async function requireAdmin(): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return ((data?.role ?? "user") as Role) === "admin" ? { id: user.id } : null;
}

/**
 * Settle the outstanding profit pool: snapshot the profit accrued since the last
 * settlement (or PROFIT_START), distribute it across the active shareholder
 * roster by share %, and record the settlement plus a per-shareholder snapshot.
 * The cutoff resets the outstanding balance to zero.
 */
export async function settleShareholdersAction(params?: {
  note?: string;
}): Promise<{ ok: true; pool: number } | { ok: false; error: string }> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();

  const { data: holdersRaw, error: holdersErr } = await admin
    .from("shareholders")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (holdersErr) return { ok: false, error: holdersErr.message };
  const holders = (holdersRaw as Shareholder[]) ?? [];
  if (holders.length === 0) return { ok: false, error: "Add at least one active shareholder first." };

  const pct = totalPercent(holders);
  if (Math.abs(pct - 100) > 0.01) {
    return { ok: false, error: `Active shares must total 100% (currently ${pct}%).` };
  }

  // Latest cutoff so we only settle what's outstanding.
  const { data: last } = await admin
    .from("profit_settlements")
    .select("settled_through")
    .order("settled_through", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sinceIso = (last as { settled_through: string } | null)?.settled_through ?? null;

  const cutoff = new Date().toISOString();
  const { data: orders, error } = await admin
    .from("orders")
    .select("created_at, status, subtotal, admin_delivery_earning, order_items(quantity, cost_price)")
    .not("status", "eq", "cancelled")
    .lte("created_at", cutoff);
  if (error) return { ok: false, error: error.message };

  const pool = computeProfitPool((orders as unknown as ProfitOrder[]) ?? [], sinceIso);
  if (pool <= 0) return { ok: false, error: "No profit to settle." };

  const splits = splitPool(pool, holders);

  const { data: settlement, error: insErr } = await admin
    .from("profit_settlements")
    .insert({
      profit_base: Number(pool.toFixed(2)),
      settled_through: cutoff,
      note: params?.note?.trim() || null,
      created_by: actor.id,
    })
    .select("id")
    .single();
  if (insErr || !settlement) return { ok: false, error: insErr?.message ?? "Failed to record settlement." };

  const { error: sharesErr } = await admin.from("profit_settlement_shares").insert(
    splits.map((s) => ({
      settlement_id: settlement.id,
      shareholder_id: s.id,
      name: s.name,
      type: s.type,
      share_percent: Number(s.share_percent),
      amount: s.amount,
    }))
  );
  if (sharesErr) {
    // Roll back the parent so we never leave a settlement without its shares.
    await admin.from("profit_settlements").delete().eq("id", settlement.id);
    return { ok: false, error: sharesErr.message };
  }

  revalidatePath("/admin/shareholders");
  revalidatePath("/admin/reports");
  return { ok: true, pool: Number(pool.toFixed(2)) };
}

function parsePercent(value: number | string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Number(n.toFixed(2));
}

export async function addShareholderAction(input: {
  name: string;
  type?: string;
  share_percent: number | string;
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
    .insert({ name, type: input.type?.trim() || null, share_percent, sort_order: count ?? 0 })
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
    .update({ name, type: input.type?.trim() || null, share_percent, is_active: input.is_active })
    .eq("id", input.id)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/shareholders");
  revalidatePath("/admin/reports");
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
