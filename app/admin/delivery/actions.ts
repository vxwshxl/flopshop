"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { adjustWallet } from "@/lib/server/wallet";
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
 * one batch. Admin only — this is the "marked paid" step; the partner confirms
 * receipt afterwards.
 *
 * Earnings are paid as store credit, not cash: the partner hands over the FULL
 * cash they collected at the door, and their cut on every order (cash and UPI
 * alike) is credited to their wallet, which they draw down through the normal
 * withdrawal flow. That replaces the old arrangement where they kept their cut
 * out of the COD cash and the shop paid out their UPI-order cut separately.
 */
export async function settleDeliveryPartnerAction(partnerId: string) {
  const actor = await requireRole(["admin"]);
  if (!actor) return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();
  const { data: orders, error: ordErr } = await admin
    .from("orders")
    .select("id, payment_method, total_amount, cash_collected, delivery_person_earning")
    .eq("delivery_person_id", partnerId)
    .eq("order_type", "delivery")
    .eq("status", "delivered")
    .is("settlement_id", null);

  if (ordErr) return { ok: false, error: ordErr.message };
  const list = orders ?? [];
  if (list.length === 0) return { ok: false, error: "Nothing to settle for this partner." };

  let cashToCollect = 0; // full COD cash the partner is holding for the shop
  let walletCredit = 0; // their earnings across every order, paid as store credit
  for (const o of list) {
    // What the partner is actually holding — the cash taken at the door, which
    // differs from the order total when they had no change and the difference
    // went to/from the customer's wallet.
    const cash = Number(o.cash_collected ?? o.total_amount);
    walletCredit += Number(o.delivery_person_earning);
    if ((o.payment_method ?? "").toLowerCase() !== "upi") cashToCollect += cash;
  }
  const net = cashToCollect;

  const { data: settlement, error: insErr } = await admin
    .from("delivery_settlements")
    .insert({
      delivery_person_id: partnerId,
      order_count: list.length,
      cash_to_collect: cashToCollect,
      upi_payout: 0,
      wallet_credited: walletCredit,
      net_amount: net,
      created_by: actor.id,
    })
    .select("id")
    .single();
  if (insErr || !settlement) return { ok: false, error: insErr?.message ?? "Failed to create settlement." };

  // Pay the earnings into the partner's wallet. If this fails the batch never
  // happened — drop the settlement row so "Settle up" can be retried cleanly
  // rather than leaving orders marked settled but unpaid.
  if (walletCredit > 0) {
    const credited = await adjustWallet({
      owner: { profileId: partnerId },
      amount: walletCredit,
      type: "adjustment",
      actorId: actor.id,
      note: `Delivery earnings — ${list.length} order${list.length === 1 ? "" : "s"}`,
    });
    if (!credited.ok) {
      await admin.from("delivery_settlements").delete().eq("id", settlement.id);
      return { ok: false, error: credited.error };
    }
  }

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
  revalidatePath("/admin/users");
  revalidatePath("/admin/wallet");
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
