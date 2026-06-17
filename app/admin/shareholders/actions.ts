"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { computeProfitPool, splitProfit, type ProfitOrder } from "@/lib/utils/shareholders";
import type { Role } from "@/lib/types";

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
 * settlement (or PROFIT_START), distribute it Philip 50% / Zau 40% / Vee 10%,
 * and record a settlement row with `settled_through = now()`. The cutoff resets
 * the outstanding balance to zero for subsequent computations.
 */
export async function settleShareholdersAction(params?: {
  note?: string;
}): Promise<{ ok: true; pool: number } | { ok: false; error: string }> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();

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

  const { philip, zau, vee } = splitProfit(pool);

  const { error: insErr } = await admin.from("profit_settlements").insert({
    profit_base: Number(pool.toFixed(2)),
    settled_through: cutoff,
    philip_amount: philip,
    zau_amount: zau,
    vee_amount: vee,
    note: params?.note?.trim() || null,
    created_by: actor.id,
  });
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/admin/shareholders");
  revalidatePath("/admin/reports");
  return { ok: true, pool: Number(pool.toFixed(2)) };
}
