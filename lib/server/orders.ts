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
  const otp_code = generateOtp();

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
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
    })
    .select()
    .single();

  if (orderErr || !order) return { ok: false, error: orderErr?.message ?? "Failed to create order." };

  const { error: itemsErr } = await supabase
    .from("order_items")
    .insert(lineItems.map((li) => ({ ...li, order_id: order.id })));

  if (itemsErr) {
    await supabase.from("orders").delete().eq("id", order.id);
    return { ok: false, error: itemsErr.message };
  }

  // Deduct stock if the order is created confirmed.
  if (input.confirm) {
    for (const li of lineItems) {
      await supabase.rpc("adjust_stock", { p_product_id: li.product_id, p_delta: -li.quantity });
    }
  }

  return { ok: true, order: { ...(order as Order), order_items: lineItems as Order["order_items"] } };
}

/**
 * Updates an order's status, adjusting stock for the stock-affecting transition.
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus
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

  const { error: updErr } = await supabase
    .from("orders")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  if (updErr) return { ok: false, error: updErr.message };
  return { ok: true };
}
