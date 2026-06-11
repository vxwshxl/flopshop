import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { createOrder } from "@/lib/server/orders";
import { notifyNewOrder } from "@/lib/push/server";
import type { OrderType, PaymentMethod } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const {
    items,
    order_type,
    customer_name,
    customer_phone,
    customer_room,
    payment_method,
    notes,
  } = body as {
    items: { product_id: string; quantity: number }[];
    order_type: OrderType;
    customer_name: string;
    customer_phone?: string;
    customer_room?: string;
    payment_method?: PaymentMethod;
    notes?: string;
  };

  // Identify the user (if any).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Ordering now requires an account (no guest checkout).
  if (!user) {
    return NextResponse.json({ error: "Please sign in to place an order." }, { status: 401 });
  }

  // Only order types the admin has enabled may be placed online.
  const settings = await getSettings();
  const enabled = (settings.order_types_enabled ?? "pickup,delivery").split(",").filter(Boolean);
  if (!enabled.includes(order_type)) {
    return NextResponse.json({ error: "That order type isn't available right now." }, { status: 400 });
  }

  if (order_type === "delivery" && !customer_room?.trim()) {
    return NextResponse.json({ error: "Room number is required for delivery." }, { status: 400 });
  }

  const result = await createOrder({
    items,
    order_type,
    customer_name,
    customer_phone,
    customer_room,
    payment_method,
    notes,
    user_id: user.id,
    is_manual: false,
    confirm: false,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // Ring the admins (and delivery partners for delivery orders). Best-effort.
  if (result.order) {
    await notifyNewOrder({
      id: result.order.id,
      order_number: result.order.order_number,
      order_type: result.order.order_type,
      total_amount: Number(result.order.total_amount),
      customer_name: result.order.customer_name,
    });
  }

  return NextResponse.json({ order: result.order });
}
