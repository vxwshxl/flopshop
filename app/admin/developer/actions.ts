"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { computeDevShare, type DevShareOrder } from "@/lib/utils/devShare";
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
 * Settle the developer's outstanding share: snapshot the share accrued since the
 * last settlement (or DEV_FEE_START) and record a settlement row with a
 * `settled_through = now()` cutoff. Subsequent reports compute outstanding share
 * only over orders created after this cutoff.
 */
export async function settleDeveloperAction(params?: {
  note?: string;
  method?: "cash" | "upi" | "split";
  /** For split payouts: how much of the share was paid in cash (rest is UPI). */
  cashPortion?: number;
}): Promise<{ ok: true; amount: number } | { ok: false; error: string }> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "Not authorized." };

  const method = params?.method ?? "cash";
  if (!["cash", "upi", "split"].includes(method)) {
    return { ok: false, error: "Invalid payout method." };
  }

  const admin = createAdminClient();

  // Latest cutoff so we only settle what's outstanding.
  const { data: last } = await admin
    .from("developer_settlements")
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

  const { base, share } = computeDevShare((orders as unknown as DevShareOrder[]) ?? [], sinceIso);
  if (share <= 0) return { ok: false, error: "Nothing outstanding to settle." };

  const amount = Number(share.toFixed(2));
  // Split the payout into cash / UPI for the record.
  const paidCash =
    method === "cash"
      ? amount
      : method === "upi"
        ? 0
        : Math.min(Math.max(Number(params?.cashPortion) || 0, 0), amount);
  const paidUpi = Number((amount - paidCash).toFixed(2));

  const { error: insErr } = await admin.from("developer_settlements").insert({
    amount,
    profit_base: Number(base.toFixed(2)),
    settled_through: cutoff,
    method,
    paid_cash: Number(paidCash.toFixed(2)),
    paid_upi: paidUpi,
    note: params?.note?.trim() || null,
    created_by: actor.id,
  });
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/admin/developer");
  revalidatePath("/admin/reports");
  return { ok: true, amount };
}
