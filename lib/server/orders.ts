import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { generateOrderNumber, generateInvoiceNumber } from "@/lib/utils/invoice";
import { deliverySplit, statusDeductsStock } from "@/lib/utils/orderHelpers";
import { settingsToMap, DEFAULT_SETTINGS } from "@/lib/utils/settings";
import type { Order, OrderStatus, OrderType, PaymentMethod } from "@/lib/types";

function generateOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export interface CreateOrderInput {
  items: { product_id: string; quantity: number }[];
  order_type: OrderType;
  customer_name: string;
  customer_phone?: string | null;
  customer_room?: string | null;
  payment_method?: PaymentMethod;
  notes?: string | null;
  user_id?: string | null;
  is_manual?: boolean;
  /** When true the order is created already confirmed and stock is deducted. */
  confirm?: boolean;
}

export interface CreateOrderResult {
  ok: boolean;
  error?: string;
  order?: Order;
}

/**
 * Creates an order server-side. Prices and stock are validated against the DB
 * (never trusted from the client). Uses the service-role client so guest pickup
 * orders can be written despite RLS.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const supabase = createAdminClient();

  if (!input.items?.length) return { ok: false, error: "Cart is empty." };
  if (!input.customer_name?.trim()) return { ok: false, error: "Customer name is required." };

  // Load settings for delivery split + open status.
  const { data: settingRows } = await supabase.from("settings").select("key, value");
  const settings = { ...DEFAULT_SETTINGS, ...settingsToMap(settingRows) };

  // Load the real products.
  const ids = input.items.map((i) => i.product_id);
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, name, selling_price, current_stock, is_active")
    .in("id", ids);

  if (prodErr) return { ok: false, error: prodErr.message };

  const productMap = new Map((products ?? []).map((p) => [p.id, p]));

  const lineItems = [];
  let subtotal = 0;
  for (const item of input.items) {
    const p = productMap.get(item.product_id);
    if (!p || !p.is_active) return { ok: false, error: "A product is no longer available." };
    const qty = Math.max(1, Math.floor(item.quantity));
    if (input.confirm && p.current_stock < qty) {
      return { ok: false, error: `Not enough stock for ${p.name}.` };
    }
    const unit = Number(p.selling_price);
    const total = unit * qty;
    subtotal += total;
    lineItems.push({
      product_id: p.id,
      product_name: p.name,
      quantity: qty,
      unit_price: unit,
      total_price: total,
    });
  }

  const split = deliverySplit(settings, input.order_type);
  const total_amount = subtotal + split.delivery_fee;

  // Invoice sequence: count orders already invoiced today.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOfDay.toISOString());

  const order_number = generateOrderNumber();
  const invoice_number = generateInvoiceNumber(count ?? 0);
  const status: OrderStatus = input.confirm ? "confirmed" : "pending";
  // Every order gets an OTP (the column is NOT NULL). Manual / walk-in orders
  // simply never require it at completion — that's gated on `is_manual`.
  const otp_code = generateOtp();

  const orderPayload = {
    order_number,
    invoice_number,
    user_id: input.user_id ?? null,
    customer_name: input.customer_name.trim(),
    customer_phone: input.customer_phone || null,
    customer_room: input.customer_room || null,
    order_type: input.order_type,
    status,
    subtotal,
    delivery_fee: split.delivery_fee,
    delivery_person_earning: split.delivery_person_earning,
    admin_delivery_earning: split.admin_delivery_earning,
    total_amount,
    payment_method: input.payment_method ?? "cash",
    notes: input.notes || null,
    is_manual: input.is_manual ?? false,
    otp_code,
  };

  const { data: result, error: rpcErr } = await supabase.rpc("checkout_order", {
    p_order: orderPayload,
    p_items: lineItems,
  });

  if (rpcErr) return { ok: false, error: rpcErr.message };
  const payload = result as { ok: boolean; error?: string; order_id?: string };
  if (!payload.ok) {
    if (payload.error?.includes("Insufficient stock")) {
      return { ok: false, error: "Not enough stock for one or more items." };
    }
    return { ok: false, error: payload.error ?? "Failed to create order." };
  }

  if (input.confirm) {
    const { error: payErr } = await supabase
      .from("orders")
      .update({ payment_status: "paid", updated_at: new Date().toISOString() })
      .eq("id", payload.order_id);
    if (payErr) return { ok: false, error: payErr.message };
  }

  // To return the full order object for the client, we fetch it back since the RPC just returns the ID
  const { data: finalOrder } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", payload.order_id)
    .single();

  return { ok: true, order: finalOrder as Order };
}

/**
 * Updates an order's status, adjusting stock for the stock-affecting transition.
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  cancel_reason?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status, order_items(product_id, quantity)")
    .eq("id", orderId)
    .single();

  if (error || !order) return { ok: false, error: error?.message ?? "Order not found." };

  const oldStatus = order.status as OrderStatus;
  if (oldStatus === newStatus) return { ok: true };

  const wasDeducted = statusDeductsStock(oldStatus);
  const willDeduct = statusDeductsStock(newStatus);
  const items = (order.order_items ?? []) as { product_id: string; quantity: number }[];

  // pending → confirmed/etc: deduct. anything-deducted → cancelled: restore.
  if (!wasDeducted && willDeduct) {
    for (const it of items) {
      if (it.product_id)
        await supabase.rpc("adjust_stock", { p_product_id: it.product_id, p_delta: -it.quantity });
    }
  } else if (wasDeducted && !willDeduct) {
    for (const it of items) {
      if (it.product_id)
        await supabase.rpc("adjust_stock", { p_product_id: it.product_id, p_delta: it.quantity });
    }
  }

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };
  if (newStatus === "cancelled") {
    updatePayload.cancel_reason = cancel_reason || null;
  } else {
    updatePayload.cancel_reason = null;
  }
  // Confirming an order is the single point that auto-marks it paid. No other
  // transition touches payment status (admins toggle it manually if needed).
  if (newStatus === "confirmed") {
    updatePayload.payment_status = "paid";
  }

  const { error: updErr } = await supabase
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId);

  if (updErr) return { ok: false, error: updErr.message };
  return { ok: true };
}
