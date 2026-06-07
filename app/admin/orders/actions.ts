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

  // Delivery persons may only mark their assigned orders delivered / out_for_delivery.
  if (actor.role === "delivery") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("orders")
      .select("delivery_person_id")
      .eq("id", orderId)
      .single();
    if (data?.delivery_person_id !== actor.id) return { ok: false, error: "Not your order." };
    if (status !== "delivered" && status !== "out_for_delivery")
      return { ok: false, error: "Not allowed." };
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
