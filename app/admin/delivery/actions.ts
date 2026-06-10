"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

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

/**
 * Settle (reconcile) all of a delivery partner's unsettled delivered orders into
 * one batch. Computes the COD cash the partner owes the shop and the shop's
 * UPI-order payout owed to the partner, records the net, and stamps each order
 * with the new settlement id. Admin only — this is the "marked paid" step; the
 * partner confirms receipt afterwards.
 */
export async function settleDeliveryPartnerAction(partnerId: string) {
  const actor = await requireRole(["admin"]);
  if (!actor) return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();
  const { data: orders, error: ordErr } = await admin
    .from("orders")
    .select("id, payment_method, total_amount, delivery_person_earning")
    .eq("delivery_person_id", partnerId)
    .eq("order_type", "delivery")
    .eq("status", "delivered")
    .is("settlement_id", null);

  if (ordErr) return { ok: false, error: ordErr.message };
  const list = orders ?? [];
  if (list.length === 0) return { ok: false, error: "Nothing to settle for this partner." };

  let cashToCollect = 0; // partner is holding this COD cash for the shop (minus their cut)
  let upiPayout = 0; // shop owes the partner their earnings on UPI-paid orders
  for (const o of list) {
    const total = Number(o.total_amount);
    const earning = Number(o.delivery_person_earning);
    if ((o.payment_method ?? "").toLowerCase() === "upi") {
      upiPayout += earning;
    } else {
      cashToCollect += total - earning;
    }
  }
  const net = cashToCollect - upiPayout;

  const { data: settlement, error: insErr } = await admin
    .from("delivery_settlements")
    .insert({
      delivery_person_id: partnerId,
      order_count: list.length,
      cash_to_collect: cashToCollect,
      upi_payout: upiPayout,
      net_amount: net,
      created_by: actor.id,
    })
    .select("id")
    .single();
  if (insErr || !settlement) return { ok: false, error: insErr?.message ?? "Failed to create settlement." };

  const { error: updErr } = await admin
    .from("orders")
    .update({ settlement_id: settlement.id })
    .in(
      "id",
      list.map((o) => o.id)
    );
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/admin/delivery");
  revalidatePath("/delivery");
  return { ok: true };
}

/**
 * The delivery partner confirms a settlement is squared (received their payout,
 * or handed over the cash they owed). Only the partner the settlement belongs to
 * can confirm it.
 */
export async function confirmSettlementAction(settlementId: string) {
  const actor = await requireRole(["admin", "delivery"]);
  if (!actor) return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();
  const { data: s } = await admin
    .from("delivery_settlements")
    .select("id, delivery_person_id, confirmed")
    .eq("id", settlementId)
    .single();

  if (!s) return { ok: false, error: "Settlement not found." };
  if (s.delivery_person_id !== actor.id) {
    return { ok: false, error: "Only the assigned partner can confirm this settlement." };
  }
  if (s.confirmed) return { ok: true };

  const { error } = await admin
    .from("delivery_settlements")
    .update({ confirmed: true, confirmed_at: new Date().toISOString() })
    .eq("id", settlementId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/delivery");
  revalidatePath("/delivery");
  return { ok: true };
}
