"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { createOrder, updateOrderStatus, type CreateOrderInput } from "@/lib/server/orders";
import { statusDeductsStock, EDITABLE_PAYMENT_METHODS, type EditablePaymentMethod } from "@/lib/utils/orderHelpers";
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
    .select("order_type, delivery_person_id, otp_code, status, is_manual")
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

  // OTP completion only applies to online orders that actually have one. Manual /
  // walk-in orders are handed over in person, so an admin completes them directly.
  if (status === "delivered" && !order.is_manual && order.otp_code) {
    if (!otp_code || otp_code.trim().length !== 4) {
      return { ok: false, error: "Enter the 4-digit order OTP." };
    }
    if (order.otp_code !== otp_code.trim()) {
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
  // Whoever delivers the order — delivery partner OR an admin who claimed it —
  // always earns the delivery-person share from settings. The split set at
  // order creation (person 8 / shop 2) is kept regardless of payment method
  // (cash collected at the door, or UPI paid to the shop QR).

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

/**
 * Customer paid the shop's UPI at the door (the delivery person couldn't accept
 * UPI). The order's OTP is the shared proof: a correct OTP — read out by the
 * customer only after they've paid — marks the order PAID (UPI) and delivered in
 * one step. Reserved for whoever is assigned to the delivery.
 */
export async function confirmUpiToShopAction(orderId: string, otp_code: string) {
  const actor = await requireRole(["admin", "delivery"]);
  if (!actor) return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("order_type, delivery_person_id, otp_code, status, is_manual")
    .eq("id", orderId)
    .single();
  if (!order) return { ok: false, error: "Order not found." };

  if (order.order_type !== "delivery") {
    return { ok: false, error: "Only delivery orders use shop-UPI payment." };
  }
  if (order.delivery_person_id !== actor.id) {
    return { ok: false, error: "Only the assigned delivery partner can confirm this payment." };
  }
  if (order.status === "delivered" || order.status === "cancelled") {
    return { ok: false, error: "This order is already closed." };
  }
  // OTP is the proof. Online orders always carry one; only skip if there is none.
  if (order.otp_code) {
    if (!otp_code || otp_code.trim().length !== 4) {
      return { ok: false, error: "Enter the customer's 4-digit OTP." };
    }
    if (order.otp_code !== otp_code.trim()) {
      return { ok: false, error: "Incorrect OTP. Please try again." };
    }
  }

  // Mark paid via UPI, then complete the delivery (stock handling lives there).
  const { error: payErr } = await admin
    .from("orders")
    .update({ payment_method: "upi", payment_status: "paid", updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (payErr) return { ok: false, error: payErr.message };

  const result = await updateOrderStatus(orderId, "delivered");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/delivery");
  return result;
}

/**
 * Admin edits an order's line items: swap a flavour, fix qty/price, ADD a brand
 * new line, or remove one. Existing rows carry an `id` (matched + updated);
 * rows without an `id` are inserted; any existing item the admin dropped from
 * the list is deleted. The order's subtotal/total are recomputed afterwards,
 * and the customer's order page updates live (it subscribes to realtime).
 */
export async function updateOrderItemsAction(
  orderId: string,
  items: { id?: string | null; product_id?: string | null; product_name: string; quantity: number; unit_price: number }[]
) {
  if (!(await requireRole(["admin"]))) return { ok: false, error: "Not authorized." };
  if (!items.length) return { ok: false, error: "An order must have at least one item." };
  const admin = createAdminClient();

  // Anything currently on the order but not resubmitted gets removed.
  const { data: existing } = await admin.from("order_items").select("id").eq("order_id", orderId);
  const keepIds = new Set(items.filter((i) => i.id).map((i) => i.id as string));
  const toDelete = (existing ?? []).map((r) => r.id).filter((id) => !keepIds.has(id));

  // Cost snapshot for brand-new lines: read the product's live cost so profit
  // reports stay accurate (matches how createOrder snapshots cost at order time).
  const newProductIds = [...new Set(items.filter((i) => !i.id && i.product_id).map((i) => i.product_id as string))];
  const costMap = new Map<string, number>();
  if (newProductIds.length) {
    const { data: prods } = await admin.from("products").select("id, cost_price").in("id", newProductIds);
    for (const p of prods ?? []) costMap.set(p.id, Number(p.cost_price) || 0);
  }

  for (const it of items) {
    const qty = Math.max(1, Math.floor(it.quantity));
    const unit = Math.max(0, Number(it.unit_price) || 0);
    const name = it.product_name.trim() || "Item";
    if (it.id) {
      const { error } = await admin
        .from("order_items")
        .update({ product_name: name, quantity: qty, unit_price: unit, total_price: qty * unit })
        .eq("id", it.id)
        .eq("order_id", orderId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await admin.from("order_items").insert({
        order_id: orderId,
        product_id: it.product_id ?? null,
        product_name: name,
        quantity: qty,
        unit_price: unit,
        total_price: qty * unit,
        cost_price: it.product_id ? costMap.get(it.product_id) ?? 0 : 0,
      });
      if (error) return { ok: false, error: error.message };
    }
  }

  if (toDelete.length) {
    const { error } = await admin.from("order_items").delete().in("id", toDelete).eq("order_id", orderId);
    if (error) return { ok: false, error: error.message };
  }

  const { error: recalcErr } = await admin.rpc("recompute_order_totals", { p_order_id: orderId });
  if (recalcErr) return { ok: false, error: recalcErr.message };

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
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

/**
 * Edit an order's (walk-in) customer details — name, phone, room. Admin only.
 * Updates the denormalised fields stored on the order itself.
 */
export async function updateOrderCustomerAction(
  orderId: string,
  data: { customer_name: string; customer_phone?: string | null; customer_room?: string | null }
) {
  if (!(await requireRole(["admin"]))) return { ok: false, error: "Not authorized." };
  const name = data.customer_name?.trim();
  if (!name) return { ok: false, error: "Customer name is required." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({
      customer_name: name,
      customer_phone: data.customer_phone?.trim() || null,
      customer_room: data.customer_room?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Change an order's payment method (admin only). Switching to any single method
 * clears the split breakdown so reports attribute the whole amount to one bucket.
 */
export async function setPaymentMethodAction(orderId: string, method: string) {
  if (!(await requireRole(["admin"]))) return { ok: false, error: "Not authorized." };
  const normalized = method.trim().toLowerCase();
  if (!EDITABLE_PAYMENT_METHODS.includes(normalized as EditablePaymentMethod)) {
    return { ok: false, error: "Invalid payment method." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ payment_method: normalized, paid_cash: 0, paid_upi: 0, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/reports");
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Permanently delete an order (and its items, via ON DELETE CASCADE). If the
 * order had deducted stock (any non-pending, non-cancelled status), the stock is
 * restored first so inventory stays correct. Admin only — irreversible.
 */
export async function deleteOrderAction(orderId: string) {
  if (!(await requireRole(["admin"]))) return { ok: false, error: "Not authorized." };
  const admin = createAdminClient();

  const { data: order, error } = await admin
    .from("orders")
    .select("id, status, order_items(product_id, quantity)")
    .eq("id", orderId)
    .single();
  if (error || !order) return { ok: false, error: error?.message ?? "Order not found." };

  // Put stock back if this order was holding it.
  if (statusDeductsStock(order.status as OrderStatus)) {
    const items = (order.order_items ?? []) as { product_id: string | null; quantity: number }[];
    for (const it of items) {
      if (it.product_id)
        await admin.rpc("adjust_stock", { p_product_id: it.product_id, p_delta: it.quantity });
    }
  }

  const { error: delErr } = await admin.from("orders").delete().eq("id", orderId);
  if (delErr) return { ok: false, error: delErr.message };

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return { ok: true };
}

export async function createManualOrderAction(
  input: Omit<CreateOrderInput, "confirm" | "is_manual"> & { payment_pending?: boolean }
) {
  const actor = await requireRole(["admin"]);
  if (!actor) return { ok: false, error: "Not authorized." };

  const { payment_pending, ...orderInput } = input;

  // Walk-in orders are handed over on the spot: create confirmed + paid, then
  // mark completed so it lands fully done (no OTP — manual orders skip it).
  const res = await createOrder({ ...orderInput, is_manual: true, confirm: true });
  if (!res.ok || !res.order) return res;

  await updateOrderStatus(res.order.id, "delivered");

  // The goods are handed over, but the admin couldn't collect payment yet (e.g.
  // the UPI app/server was down). Flip it back to pending so it can be marked
  // paid from the orders page once the payment actually goes through.
  if (payment_pending) {
    const admin = createAdminClient();
    await admin
      .from("orders")
      .update({ payment_status: "pending", updated_at: new Date().toISOString() })
      .eq("id", res.order.id);
  }
  // Remember the walk-in customer (best-effort) so the name auto-suggests next
  // time. Matched by name (case-insensitive): a new name is added, an existing
  // one is merged — filling in a phone/room we didn't have before.
  await upsertCustomerByName(input.customer_name, input.customer_phone, input.customer_room);
  revalidatePath("/admin/orders/new");
  revalidatePath("/admin/orders");
  return { ...res, order: { ...res.order, status: "delivered" as OrderStatus } };
}

/**
 * Save/merge a walk-in customer into the `customers` directory. Phone is
 * optional (the table requires NOT NULL, so we store an empty string when none
 * is given). Never throws — a failure here must not fail the completed order.
 */
async function upsertCustomerByName(
  name: string,
  phone?: string | null,
  room?: string | null
) {
  const trimmed = name?.trim();
  if (!trimmed) return;
  const admin = createAdminClient();
  try {
    // ilike with no wildcards is an exact, case-insensitive match.
    const { data: matches } = await admin
      .from("customers")
      .select("id, phone, room_number")
      .ilike("name", trimmed)
      .limit(1);
    const existing = matches?.[0];

    if (existing) {
      const patch: Record<string, unknown> = {};
      if (phone?.trim() && !existing.phone?.trim()) patch.phone = phone.trim();
      if (room?.trim() && room.trim() !== (existing.room_number ?? "")) patch.room_number = room.trim();
      if (Object.keys(patch).length) {
        patch.updated_at = new Date().toISOString();
        await admin.from("customers").update(patch).eq("id", existing.id);
      }
    } else {
      await admin.from("customers").insert({
        name: trimmed,
        phone: phone?.trim() || "",
        room_number: room?.trim() || null,
      });
    }
  } catch {
    // Directory bookkeeping only — swallow errors so the order still succeeds.
  }
}
