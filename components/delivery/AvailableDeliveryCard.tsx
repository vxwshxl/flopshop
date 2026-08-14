"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Truck, Package, Wallet, StickyNote } from "lucide-react";
import { claimDeliveryOrderAction } from "@/app/admin/orders/actions";
import { OrderStatusBadge } from "@/components/store/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatCurrency, formatDateTime, formatPaymentMethod, formatTime } from "@/lib/utils/formatters";
import type { Order } from "@/lib/types";

export function AvailableDeliveryCard({ order, currency }: { order: Order; currency: string }) {
  const [pending, startTransition] = useTransition();
  const [showDetails, setShowDetails] = useState(false);
  const router = useRouter();

  const items = order.order_items ?? [];
  const itemCount = items.length;

  // Wallet-credit orders are already paid — the partner collects nothing at the
  // door, which is the single biggest thing to know before taking the order.
  const amountDue = Math.max(Number(order.total_amount) - Number(order.amount_paid ?? 0), 0);
  const prepaid = order.payment_method === "credit" && amountDue <= 0;

  function claim() {
    startTransition(async () => {
      try {
        const res = await claimDeliveryOrderAction(order.id);
        if (!res.ok) {
          toast.error(res.error ?? "Failed to claim order.");
          return;
        }
        toast.success("Order claimed. Head to pickup now.");
        setShowDetails(false);
        router.refresh();
      } catch {
        toast.error("Unable to claim order. Please try again.");
      }
    });
  }

  return (
    <div className="glass rounded-2xl p-4 transition-all hover:border-lime-400/30">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{order.order_number}</p>
          <p className="text-xs text-stone-500">{formatTime(order.created_at)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-stone-400">
        <p className="break-words font-medium text-white">{order.customer_name}</p>
        <p className="flex items-start gap-2">
          <Truck className="mt-0.5 h-4 w-4 shrink-0 text-lime-400/70" />
          <span className="min-w-0 break-words">Room {order.customer_room ?? "—"}</span>
        </p>
        <p className="flex items-start gap-2">
          <Package className="mt-0.5 h-4 w-4 shrink-0 text-lime-400/70" />
          <span className="min-w-0 break-words">
            {itemCount} item{itemCount > 1 ? "s" : ""} · {formatCurrency(order.total_amount, currency)}
          </span>
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Button size="sm" variant="outline" className="w-full" onClick={() => setShowDetails(true)}>
          Details
        </Button>
        <Button size="sm" disabled={pending} onClick={claim} className="w-full">
          Claim order
        </Button>
      </div>

      {/* Everything the partner needs to decide before committing — items, what
          they'll collect at the door and what they earn. Contact details stay
          hidden until the order is actually theirs. */}
      <Modal open={showDetails} onClose={() => setShowDetails(false)} title={order.order_number}>
        <div className="space-y-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words font-semibold text-white">{order.customer_name}</p>
              <p className="break-words text-stone-400">Room {order.customer_room ?? "—"}</p>
            </div>
            <p className="shrink-0 text-right text-xs text-stone-500">{formatDateTime(order.created_at)}</p>
          </div>

          {itemCount > 0 && (
            <div className="glass-line rounded-xl border">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="glass-line flex items-start justify-between gap-3 border-b px-3 py-2.5 last:border-b-0"
                >
                  <span className="min-w-0 break-words text-stone-300">
                    {it.product_name}
                    <span className="text-stone-500"> ×{it.quantity}</span>
                  </span>
                  <span className="num shrink-0 text-stone-400">
                    {formatCurrency(it.total_price, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-stone-400">
              <span>Subtotal</span>
              <span className="num">{formatCurrency(order.subtotal, currency)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-stone-400">
              <span>Delivery fee</span>
              <span className="num">{formatCurrency(order.delivery_fee, currency)}</span>
            </div>
            <div className="glass-line flex items-center justify-between gap-3 border-t pt-2 font-semibold text-white">
              <span>Total</span>
              <span className="num">{formatCurrency(order.total_amount, currency)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 text-stone-400">
            <span>Payment</span>
            <span className="break-words text-right font-medium text-stone-300">
              {prepaid ? "PREPAID" : formatPaymentMethod(order, currency)}
            </span>
          </div>

          {prepaid ? (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-lime-400/10 px-2.5 py-1 text-xs font-semibold text-lime-300">
              <Wallet className="h-3.5 w-3.5" /> Paid by wallet · collect nothing
            </p>
          ) : (
            <div className="flex items-center justify-between gap-3 text-stone-400">
              <span>Collect at door</span>
              <span className="num font-semibold text-white">{formatCurrency(amountDue, currency)}</span>
            </div>
          )}

          {order.notes && (
            <p className="flex items-start gap-2 rounded-xl bg-black/30 p-3 text-stone-400">
              <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-lime-400/70" />
              <span className="min-w-0 break-words">{order.notes}</span>
            </p>
          )}

          <p className="text-xs font-semibold text-lime-400">
            You earn {formatCurrency(order.delivery_person_earning, currency)}
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <Button variant="outline" className="w-full" onClick={() => setShowDetails(false)} disabled={pending}>
              Close
            </Button>
            <Button className="w-full" disabled={pending} onClick={claim}>
              Claim order
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
