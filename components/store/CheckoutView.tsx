"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { useCart } from "@/lib/hooks/useCart";
import { useUser } from "@/lib/hooks/useUser";
import { formatCurrency } from "@/lib/utils/formatters";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { PaymentMethod, SettingsMap } from "@/lib/types";

export function CheckoutView({ settings }: { settings: SettingsMap }) {
  const { profile, isAuthenticated, loading: userLoading } = useUser();
  const hydrated = useCart((s) => s.hydrated);
  const items = useCart((s) => s.items);
  const orderType = useCart((s) => s.orderType);
  const clear = useCart((s) => s.clear);

  const currency = settings.currency_symbol ?? "₹";
  const shopOpen = settings.shop_is_open !== "false";
  const deliveryFee = Number(settings.delivery_fee ?? 10);

  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_room: "",
    payment_method: "cash" as PaymentMethod,
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<{ id: string; order_number: string; total: number } | null>(null);

  useEffect(() => {
    if (profile) {
      // Prefill once the async-loaded profile is available.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((f) => ({
        ...f,
        customer_name: f.customer_name || profile.full_name || "",
        customer_phone: f.customer_phone || profile.phone || "",
        customer_room: f.customer_room || profile.room_number || "",
      }));
    }
  }, [profile]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const fee = orderType === "delivery" ? deliveryFee : 0;
  const total = subtotal + fee;

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!shopOpen) return toast.error("The shop is currently closed.");
    setSubmitting(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({ product_id: i.id, quantity: i.quantity })),
        order_type: orderType,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_room: form.customer_room,
        payment_method: form.payment_method,
        notes: form.notes,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) return toast.error(data.error ?? "Could not place order.");
    clear();
    setPlaced({ id: data.order.id, order_number: data.order.order_number, total: data.order.total_amount });
  }

  if (!hydrated || userLoading) return <div className="p-10 text-center text-gray-400">Loading…</div>;

  if (placed) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
        <CheckCircle2 className="mb-3 h-16 w-16 text-green-500" />
        <h1 className="text-2xl font-bold text-gray-900">Order placed!</h1>
        <p className="mt-1 text-gray-500">
          Your order <span className="font-semibold text-gray-900">{placed.order_number}</span> for{" "}
          {formatCurrency(placed.total, currency)} has been received.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/">
            <Button variant="outline">Back to shop</Button>
          </Link>
          {isAuthenticated && (
            <Link href={`/orders/${placed.id}`}>
              <Button>View order</Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-24 text-center text-gray-500">
        Your cart is empty.{" "}
        <Link href="/" className="font-medium text-indigo-600 hover:underline">
          Go shopping
        </Link>
      </div>
    );
  }

  // Delivery requires auth.
  if (orderType === "delivery" && !isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-bold text-gray-900">Sign in for delivery</h1>
        <p className="mt-2 text-sm text-gray-500">
          Delivery orders require an account so we can reach you. Pickup is available as a guest.
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/login?redirect=/checkout">
            <Button size="lg">Continue with Google</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      <h1 className="mb-4 text-xl font-bold text-gray-900">Checkout</h1>
      <form onSubmit={placeOrder} className="space-y-5">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-gray-700">
            {orderType === "delivery" ? "🛵 Delivery details" : "🚶 Pickup details"}
          </p>
          <div className="space-y-3">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" required value={form.customer_name} onChange={set("customer_name")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.customer_phone} onChange={set("customer_phone")} />
              </div>
              {orderType === "delivery" && (
                <div>
                  <Label htmlFor="room">Room number</Label>
                  <Input id="room" required value={form.customer_room} onChange={set("customer_room")} />
                </div>
              )}
            </div>
            <div>
              <Label>Payment method</Label>
              <div className="flex gap-3">
                {(["cash", "upi"] as PaymentMethod[]).map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setForm((f) => ({ ...f, payment_method: m }))}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize ${
                      form.payment_method === m
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 text-gray-600"
                    }`}
                  >
                    {m === "cash" ? "💵 Cash" : "📱 UPI"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" value={form.notes} onChange={set("notes")} rows={2} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-gray-700">Order summary</p>
          {items.map((i) => (
            <div key={i.id} className="flex justify-between py-0.5 text-sm text-gray-600">
              <span>
                {i.name} × {i.quantity}
              </span>
              <span>{formatCurrency(i.price * i.quantity, currency)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal, currency)}</span>
          </div>
          {orderType === "delivery" && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Delivery fee</span>
              <span>{formatCurrency(fee, currency)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-900">
            <span>Total</span>
            <span>{formatCurrency(total, currency)}</span>
          </div>
        </div>

        <Button type="submit" size="lg" loading={submitting} disabled={!shopOpen} className="w-full">
          {shopOpen ? `Place order · ${formatCurrency(total, currency)}` : "Shop is closed"}
        </Button>
      </form>
    </div>
  );
}
