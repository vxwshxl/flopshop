"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { createOrder, updateOrderStatus, type CreateOrderInput } from "@/lib/server/orders";
import type { OrderStatus, PaymentStatus, Role } from "@/lib/types";

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

export async function setOrderStatusAction(orderId: string, status: OrderStatus) {
  const actor = await requireRole(["admin", "delivery"]);
  if (!actor) return { ok: false, error: "Not authorized." };

  // Read the order (service role) to enforce type/ownership rules.
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("order_type, delivery_person_id")
    .eq("id", orderId)
    .single();
  if (!order) return { ok: false, error: "Order not found." };

  const isDelivery = order.order_type === "delivery";
  // Dispatch + completion of a delivery order belong to the assigned partner.
  const isDispatchOrComplete = status === "out_for_delivery" || status === "delivered";

  if (actor.role === "delivery") {
    // Delivery partners only touch delivery orders assigned to them, and only dispatch / complete.
    if (!isDelivery || order.delivery_person_id !== actor.id)
      return { ok: false, error: "Not your order." };
    if (!isDispatchOrComplete) return { ok: false, error: "Not allowed." };
  } else if (isDelivery && isDispatchOrComplete) {
    // Admin can confirm / prepare / assign / cancel a delivery order, but only the
    // assigned delivery partner can dispatch it or mark it delivered.
    return {
      ok: false,
      error: "Only the assigned delivery partner can mark a delivery order delivered.",
    };
  }

  const result = await updateOrderStatus(orderId, status);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/delivery");
  return result;
}

export async function assignDeliveryAction(orderId: string, deliveryPersonId: string | null) {
  const actor = await requireRole(["admin"]);
  if (!actor) return { ok: false, error: "Not authorized." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ delivery_person_id: deliveryPersonId, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/delivery");
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setPaymentStatusAction(orderId: string, status: PaymentStatus) {
  const actor = await requireRole(["admin", "delivery"]);
  if (!actor) return { ok: false, error: "Not authorized." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ payment_status: status, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function createManualOrderAction(input: Omit<CreateOrderInput, "confirm" | "is_manual">) {
  const actor = await requireRole(["admin"]);
  if (!actor) return { ok: false, error: "Not authorized." };
  return createOrder({ ...input, is_manual: true, confirm: true });
}
