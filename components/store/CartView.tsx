"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/hooks/useCart";
import { formatCurrency } from "@/lib/utils/formatters";
import { Button } from "@/components/ui/button";
import type { SettingsMap } from "@/lib/types";
import toast from "react-hot-toast";
import { useSettings } from "@/lib/hooks/useSettings";

export function CartView({ settings }: { settings: SettingsMap }) {
  const router = useRouter();
  const hydrated = useCart((s) => s.hydrated);
  const items = useCart((s) => s.items);
  const orderType = useCart((s) => s.orderType);
  const setOrderType = useCart((s) => s.setOrderType);
  const increment = useCart((s) => s.increment);
  const decrement = useCart((s) => s.decrement);
  const removeItem = useCart((s) => s.removeItem);

  const currency = settings.currency_symbol ?? "₹";
  const deliveryFee = Number(settings.delivery_fee ?? 10);
  const deliveryShare = Number(settings.delivery_person_share ?? 8);
  const adminShare = Number(settings.admin_delivery_share ?? 2);
  const { isOpen } = useSettings();

  if (!hydrated) return <div className="p-10 text-center text-stone-400">Loading cart...</div>;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShoppingBag className="mb-3 h-12 w-12 text-stone-300 dark:text-stone-600" />
        <p className="text-stone-500 dark:text-stone-400">Your cart is empty.</p>
        <Link href="/" className="mt-4">
          <Button>Browse products</Button>
        </Link>
      </div>
    );
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const fee = orderType === "delivery" ? deliveryFee : 0;
  const total = subtotal + fee;

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      <h1 className="mb-4 text-xl font-extrabold text-stone-950 dark:text-white">Your Cart</h1>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-lg border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-stone-900">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-stone-50 dark:bg-stone-800">
              {item.image_url ? (
                <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="56px" />
              ) : (
                <div className="flex h-full items-center justify-center text-xl">🍫</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-stone-950 dark:text-white">{item.name}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400">{formatCurrency(item.price, currency)}</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-lime-500 text-stone-950">
              <button onClick={() => decrement(item.id)} className="grid h-7 w-7 place-items-center">
                <Minus className="h-3 w-3" />
              </button>
              <span className="min-w-4 text-center text-sm font-bold">{item.quantity}</span>
              <button
                onClick={() => {
                  if (!isOpen) return toast.error("The shop is currently closed.");
                  increment(item.id);
                }}
                disabled={item.quantity >= item.current_stock || !isOpen}
                className="grid h-7 w-7 place-items-center disabled:opacity-40"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <button onClick={() => removeItem(item.id)} className="p-1 text-stone-400 hover:text-red-500">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Order type */}
      <div className="mt-6">
        <p className="mb-2 text-sm font-semibold text-stone-700 dark:text-stone-300">Order Type</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setOrderType("pickup")}
            className={`rounded-lg border p-3 text-left text-sm ${
              orderType === "pickup"
                ? "border-lime-500 bg-lime-50 dark:bg-lime-400/10"
                : "border-black/10 bg-white dark:border-white/10 dark:bg-stone-900"
            }`}
          >
            <p className="font-semibold text-stone-950 dark:text-white">Pickup</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">Collect yourself · Free</p>
          </button>
          <button
            onClick={() => setOrderType("delivery")}
            className={`rounded-lg border p-3 text-left text-sm ${
              orderType === "delivery"
                ? "border-lime-500 bg-lime-50 dark:bg-lime-400/10"
                : "border-black/10 bg-white dark:border-white/10 dark:bg-stone-900"
            }`}
          >
            <p className="font-semibold text-stone-950 dark:text-white">Delivery</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">To your room · +{formatCurrency(deliveryFee, currency)}</p>
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 rounded-lg border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-stone-900">
        <div className="flex justify-between text-sm text-stone-600 dark:text-stone-400">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal, currency)}</span>
        </div>
        {orderType === "delivery" && (
          <>
            <div className="mt-2 flex justify-between text-sm text-stone-600 dark:text-stone-400">
              <span>Delivery fee</span>
              <span>{formatCurrency(deliveryFee, currency)}</span>
            </div>
            <p className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
              {formatCurrency(deliveryShare, currency)} delivery person + {formatCurrency(adminShare, currency)} shop
            </p>
          </>
        )}
        <div className="mt-3 flex justify-between border-t border-black/10 pt-3 text-base font-extrabold text-stone-950 dark:border-white/10 dark:text-white">
          <span>Total</span>
          <span>{formatCurrency(total, currency)}</span>
        </div>
      </div>

      <Button type="button" className="mt-5 w-full" size="lg" onClick={() => router.push("/checkout")} disabled={!isOpen}>
        {isOpen ? "Proceed to Checkout" : "Shop is closed"}
      </Button>
    </div>
  );
}
