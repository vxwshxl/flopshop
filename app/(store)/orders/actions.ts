"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { updateOrderStatus } from "@/lib/server/orders";
import type { OrderStatus } from "@/lib/types";

// A customer may only cancel before the shop starts working on the order.
// Cancelling restores any stock the order was holding (handled in updateOrderStatus).
const CUSTOMER_CANCELLABLE: OrderStatus[] = ["pending", "confirmed"];

/**
 * Lets the customer who placed an order cancel it themselves (while it's still
 * pending/confirmed). Ownership is enforced server-side.
 */
export async function cancelMyOrderAction(orderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, user_id, status")
    .eq("id", orderId)
    .single();

  if (!order) return { ok: false, error: "Order not found." };
  if (order.user_id !== user.id) return { ok: false, error: "This isn't your order." };
  if (!CUSTOMER_CANCELLABLE.includes(order.status as OrderStatus)) {
    return { ok: false, error: "This order can no longer be cancelled." };
  }

  const result = await updateOrderStatus(orderId, "cancelled", "Cancelled by customer");
  if (!result.ok) return result;

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { ok: true };
}
