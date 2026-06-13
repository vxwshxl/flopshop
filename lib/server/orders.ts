import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { generateOrderNumber, generateInvoiceNumber, invoiceDatePrefix } from "@/lib/utils/invoice";
import { deliverySplit, statusDeductsStock, COD_MAX } from "@/lib/utils/orderHelpers";
import { settingsToMap, DEFAULT_SETTINGS } from "@/lib/utils/settings";
import { getWalletBalance, adjustWallet, refundOrderCredit, type WalletOwner } from "@/lib/server/wallet";
import type { Order, OrderStatus, OrderType, PaymentMethod, PaymentStatus } from "@/lib/types";

function generateOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export interface CreateOrderInput {
  /** unit_price override is honoured only for manual (admin walk-in) orders. */
  items: { product_id: string; quantity: number; unit_price?: number }[];
  order_type: OrderType;
  customer_name: string;
  customer_phone?: string | null;
  customer_room?: string | null;
  payment_method?: PaymentMethod;
  /** Split payment breakdown (only when payment_method === "split"). */
  paid_cash?: number;
  paid_upi?: number;
  notes?: string | null;
  user_id?: string | null;
  is_manual?: boolean;
  /** When true the order is created already confirmed and stock is deducted. */
  confirm?: boolean;
  /**
   * Wallet to charge when payment_method === "credit". Defaults to the signed-in
   * user's wallet (`user_id`); manual orders pass a walk-in customer's wallet.
   */
  credit_owner?: WalletOwner;
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
    .select("id, name, selling_price, cost_price, current_stock, is_active")
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
    // Admins may override the price on manual walk-in orders; public checkout
    // always uses the trusted DB price.
    const unit =
      input.is_manual && item.unit_price != null && Number(item.unit_price) >= 0
        ? Number(item.unit_price)
        : Number(p.selling_price);
    const total = unit * qty;
    subtotal += total;
    lineItems.push({
      product_id: p.id,
      product_name: p.name,
      quantity: qty,
      unit_price: unit,
      total_price: total,
      // Snapshot the cost now so editing the product's cost later never
      // rewrites the profit of this (already-placed) order.
      cost_price: Number(p.cost_price),
    });
  }

  const split = deliverySplit(settings, input.order_type);
  const total_amount = subtotal + split.delivery_fee;

  // Resolve the wallet owner for credit payment up front. For credit orders the
  // wallet covers everything NOT collected by cash/UPI: a shortfall the customer
  // tops up at the counter is recorded in paid_cash / paid_upi, so the wallet
  // charge is total − cash − upi (wallet may be only part of the order).
  const creditOwner: WalletOwner | null =
    input.payment_method === "credit"
      ? input.credit_owner ?? (input.user_id ? { profileId: input.user_id } : null)
      : null;
  const creditCharge =
    input.payment_method === "credit"
      ? Math.max(total_amount - Number(input.paid_cash ?? 0) - Number(input.paid_upi ?? 0), 0)
      : 0;
  if (input.payment_method === "credit") {
    if (!creditOwner) return { ok: false, error: "No account to charge credit to." };
    const balance = await getWalletBalance(creditOwner);
    if (balance < creditCharge) {
      return { ok: false, error: "Insufficient credit balance." };
    }
  }

  // Cash-on-delivery ceiling: large delivery orders must be paid by UPI. Admin
  // walk-in (manual) orders are exempt — they're paid on the spot at the counter.
  // Credit is also exempt — no cash is in transit (it's prepaid store credit).
  if (
    !input.is_manual &&
    input.order_type === "delivery" &&
    total_amount > COD_MAX &&
    input.payment_method !== "credit" &&
    (input.payment_method ?? "cash") !== "upi"
  ) {
    return { ok: false, error: `Orders over ₹${COD_MAX} must be paid by UPI.` };
  }

  // Invoice sequence: the next number after the highest invoice already issued
  // for today's prefix. Derived from the real invoice numbers (not a row count)
  // so deleted/cancelled orders and historical imports never cause a collision.
  const prefix = invoiceDatePrefix();
  const { data: todayInvoices } = await supabase
    .from("orders")
    .select("invoice_number")
    .like("invoice_number", `${prefix}-%`);
  let seq = 0;
  for (const row of todayInvoices ?? []) {
    const m = /-(\d+)$/.exec(row.invoice_number ?? "");
    if (m) seq = Math.max(seq, Number(m[1]));
  }

  const order_number = generateOrderNumber();
  const status: OrderStatus = input.confirm ? "confirmed" : "pending";
  // Every order gets an OTP (the column is NOT NULL). Manual / walk-in orders
  // simply never require it at completion — that's gated on `is_manual`.
  const otp_code = generateOtp();

  const orderPayload = {
    order_number,
    invoice_number: "",
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
    // Cash/UPI breakdown — for "split" it's the whole order; for "credit" it's
    // the shortfall the wallet didn't cover. Zero for single-method payments.
    paid_cash:
      input.payment_method === "split" || input.payment_method === "credit"
        ? Number(input.paid_cash ?? 0)
        : 0,
    paid_upi:
      input.payment_method === "split" || input.payment_method === "credit"
        ? Number(input.paid_upi ?? 0)
        : 0,
    notes: input.notes || null,
    is_manual: input.is_manual ?? false,
    otp_code,
  };

  // Retry on the unique-invoice constraint: a concurrent order may have grabbed
  // the same sequence between our read and the insert. Bump and try again.
  let payload: { ok: boolean; error?: string; order_id?: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    orderPayload.invoice_number = generateInvoiceNumber(seq + 1 + attempt);
    const { data: result, error: rpcErr } = await supabase.rpc("checkout_order", {
      p_order: orderPayload,
      p_items: lineItems,
    });

    if (rpcErr) {
      if (rpcErr.message.includes("orders_invoice_number_key")) continue;
      return { ok: false, error: rpcErr.message };
    }
    payload = result as { ok: boolean; error?: string; order_id?: string };
    break;
  }

  if (!payload) {
    return { ok: false, error: "Could not allocate an invoice number. Please retry." };
  }
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

  // Credit payment: debit the wallet for the portion it covers (the customer
  // pays any shortfall by cash/UPI). Balance was pre-checked, but the debit is
  // atomic and rejects a concurrent overdraw — if so, undo the order.
  if (input.payment_method === "credit" && creditOwner && creditCharge > 0) {
    const debit = await adjustWallet({
      owner: creditOwner,
      amount: -creditCharge,
      type: "order_payment",
      orderId: payload.order_id,
      actorId: input.user_id ?? null,
      note: `Order ${order_number}`,
    });
    if (!debit.ok) {
      // Roll back: restore stock if it was deducted, then delete the order.
      if (input.confirm) {
        for (const it of lineItems) {
          await supabase.rpc("adjust_stock", { p_product_id: it.product_id, p_delta: it.quantity });
        }
      }
      await supabase.from("orders").delete().eq("id", payload.order_id);
      return { ok: false, error: debit.error };
    }
    // The wallet portion is collected now; the cash/UPI shortfall is collected
    // separately (on the spot for manual orders, at the door for online COD).
    const status: PaymentStatus = creditCharge >= total_amount ? "paid" : "partial";
    await supabase
      .from("orders")
      .update({ payment_status: status, amount_paid: creditCharge, updated_at: new Date().toISOString() })
      .eq("id", payload.order_id);
  }

  // To return the full order object for the client, we fetch it back since the RPC just returns the ID
  const { data: finalOrder } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", payload.order_id)
    .single();

  // New-order push notifications are sent (awaited) by the /api/orders route,
  // which reliably completes before the serverless response returns.
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
  // Payment is auto-marked paid when an order is confirmed, and again on
  // delivery/completion — cash-on-delivery is collected at the door, and the
  // order is stored with whatever method ended up being used (cash, or UPI if
  // the delivery partner switched it via the shop QR).
  if (newStatus === "confirmed" || newStatus === "delivered") {
    updatePayload.payment_status = "paid";
  }

  const { error: updErr } = await supabase
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId);

  if (updErr) return { ok: false, error: updErr.message };

  // Cancelling a credit-paid order returns the credit to the wallet (no-op for
  // other payment methods / already-refunded orders).
  if (newStatus === "cancelled") {
    await refundOrderCredit(orderId);
  }
  return { ok: true };
}
