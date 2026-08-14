"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { reportOutOfStockAction } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatCurrency } from "@/lib/utils/formatters";
import type { Order } from "@/lib/types";

/**
 * What the partner does when the shelf doesn't match the order: dial each line
 * down to what they can actually carry (0 = not available at all). Quantities
 * only go down — adding items or changing a price is an admin job — and the
 * customer is pushed a notice as soon as it's saved.
 */
export function OutOfStockModal({
  order,
  currency,
  onClose,
}: {
  order: Order;
  currency: string;
  onClose: () => void;
}) {
  const items = order.order_items ?? [];
  const [qty, setQty] = useState<Record<string, number>>(
    Object.fromEntries(items.map((it) => [it.id, it.quantity]))
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const set = (id: string, next: number, max: number) =>
    setQty((q) => ({ ...q, [id]: Math.min(Math.max(next, 0), max) }));

  const newSubtotal = items.reduce((s, it) => s + (qty[it.id] ?? it.quantity) * Number(it.unit_price), 0);
  const newTotal = newSubtotal + Number(order.delivery_fee ?? 0);
  const changed = items.some((it) => (qty[it.id] ?? it.quantity) !== it.quantity);
  const empty = items.every((it) => (qty[it.id] ?? it.quantity) === 0);

  function save() {
    startTransition(async () => {
      try {
        const res = await reportOutOfStockAction(
          order.id,
          items.map((it) => ({ id: it.id, quantity: qty[it.id] ?? it.quantity }))
        );
        if (!res.ok) {
          toast.error(res.error ?? "Couldn't update the order.");
          return;
        }
        toast.success(
          res.refunded
            ? `Order updated · ${formatCurrency(res.refunded, currency)} refunded · customer notified`
            : "Order updated · customer notified"
        );
        onClose();
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <Modal open onClose={onClose} title="Something out of stock?">
      <p className="mb-4 text-sm text-stone-400">
        Set what you can actually deliver. Drop a line to zero if it isn&apos;t available at all —
        {order.customer_name} gets a notification and the total is corrected.
      </p>

      <div className="space-y-2">
        {items.map((it) => {
          const n = qty[it.id] ?? it.quantity;
          return (
            <div
              key={it.id}
              className={`flex items-center gap-3 rounded-lg border p-3 transition ${
                n === 0 ? "border-red-500/30 bg-red-500/5" : "border-white/10"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${n === 0 ? "text-stone-500 line-through" : "text-white"}`}>
                  {it.product_name}
                </p>
                <p className="text-xs text-stone-500">
                  {formatCurrency(it.unit_price, currency)} each · ordered {it.quantity}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => set(it.id, n - 1, it.quantity)}
                  disabled={pending || n === 0}
                  aria-label={`One less ${it.product_name}`}
                  className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-white transition hover:bg-white/10 disabled:opacity-30"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-7 text-center text-sm font-bold text-white">{n}</span>
                <button
                  type="button"
                  onClick={() => set(it.id, n + 1, it.quantity)}
                  disabled={pending || n >= it.quantity}
                  aria-label={`One more ${it.product_name}`}
                  className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-white transition hover:bg-white/10 disabled:opacity-30"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2.5 text-sm">
        <span className="text-stone-400">New total</span>
        <span className="font-bold text-white">
          {formatCurrency(newTotal, currency)}
          {changed && (
            <span className="ml-2 text-xs font-medium text-stone-500 line-through">
              {formatCurrency(order.total_amount, currency)}
            </span>
          )}
        </span>
      </div>

      {empty && (
        <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300">
          Nothing left on the order — cancel it instead of emptying it.
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2.5">
        <Button variant="outline" className="w-full" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button className="w-full" onClick={save} disabled={pending || !changed || empty}>
          Save &amp; notify
        </Button>
      </div>
    </Modal>
  );
}
