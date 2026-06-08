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

export async function setOrderStatusAction(
  orderId: string,
  status: OrderStatus,
  otp_code?: string,
  cancel_reason?: string | null
) {
  const actor = await requireRole(["admin", "delivery"]);
  if (!actor) return { ok: false, error: "Not authorized." };

  // Read the order (service role) to enforce type/ownership rules.
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("order_type, delivery_person_id, otp_code, status")
    .eq("id", orderId)
    .single();
  if (!order) return { ok: false, error: "Order not found." };

  const isDelivery = order.order_type === "delivery";
  const isDispatchOrComplete = status === "out_for_delivery" || status === "delivered";
  const isAssignedToActor = order.delivery_person_id === actor.id;

  if (isDelivery && isDispatchOrComplete) {
    // Dispatch / completion of a delivery is reserved for whoever is assigned to
    // it — a delivery partner OR an admin who claimed it on the delivery page.
    if (!isAssignedToActor) {
      return { ok: false, error: "Only the assigned delivery partner can dispatch or complete this order." };
    }
  } else if (actor.role === "delivery") {
    // Delivery partners may only dispatch/complete their assigned orders (above);
    // they can't set any other status.
    return { ok: false, error: "Not allowed." };
  }

  if (status === "delivered") {
    if (!otp_code || otp_code.trim().length !== 4) {
      return { ok: false, error: "Enter the 4-digit order OTP." };
    }
    if (!order.otp_code || order.otp_code !== otp_code.trim()) {
      return { ok: false, error: "Incorrect OTP. Please try again." };
    }
  }

  if (status === "cancelled" && !cancel_reason?.trim()) {
    return { ok: false, error: "Enter a cancellation reason." };
  }

  const result = await updateOrderStatus(orderId, status, cancel_reason);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/delivery");
  return result;
}

export async function claimDeliveryOrderAction(orderId: string) {
  const actor = await requireRole(["delivery", "admin"]);
  if (!actor) return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .select("order_type, status, delivery_person_id, delivery_fee")
    .eq("id", orderId)
    .single();

  if (error || !order) return { ok: false, error: error?.message ?? "Order not found." };
  if (order.order_type !== "delivery") return { ok: false, error: "Only delivery orders can be claimed." };
  if (order.delivery_person_id) return { ok: false, error: "Order already claimed." };
  if (order.status === "delivered" || order.status === "cancelled") {
    return { ok: false, error: "This order can no longer be claimed." };
  }

  const updatePayload: Record<string, unknown> = {
    delivery_person_id: actor.id,
    updated_at: new Date().toISOString(),
  };
  if (order.status === "pending") {
    updatePayload.status = "confirmed";
  }
  // When an admin delivers it themselves, the whole delivery fee stays with the
  // shop — there's no delivery partner to pay out.
  if (actor.role === "admin") {
    updatePayload.delivery_person_earning = 0;
    updatePayload.admin_delivery_earning = Number(order.delivery_fee ?? 0);
  }

  const { error: updErr } = await admin
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId)
    .is("delivery_person_id", null);

  if (updErr) return { ok: false, error: updErr.message };
  revalidatePath("/admin/orders");
  revalidatePath("/delivery");
  return { ok: true };
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
