import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createOrder } from "@/lib/server/orders";
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

  // Delivery orders require an account.
  if (order_type === "delivery" && !user) {
    return NextResponse.json({ error: "Please sign in to place a delivery order." }, { status: 401 });
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
    user_id: user?.id ?? null,
    is_manual: false,
    confirm: false,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ order: result.order });
}
