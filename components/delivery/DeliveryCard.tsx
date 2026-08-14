"use client";

import { MapPin, Phone, Package, Wallet } from "lucide-react";
import { OrderStatusBadge } from "@/components/store/OrderStatusBadge";
import { DeliveryActions } from "./DeliveryActions";
import { formatCurrency, formatTime } from "@/lib/utils/formatters";
import type { Order } from "@/lib/types";

export function DeliveryCard({ order, currency }: { order: Order; currency: string }) {
  // Wallet-credit orders are already paid for — nothing is collected at the door,
  // so the partner must not be shown a payable amount. A partial credit order
  // (wallet didn't cover the whole total) still has a balance due.
  const amountDue = Math.max(Number(order.total_amount) - Number(order.amount_paid ?? 0), 0);
  const prepaid = order.payment_method === "credit" && amountDue <= 0;

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
        {order.customer_room && (
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-lime-400/70" />
            <span className="min-w-0 break-words">Room {order.customer_room}</span>
          </p>
        )}
        {order.customer_phone && (
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0 text-lime-400/70" />
            <a href={`tel:${order.customer_phone}`} className="min-w-0 break-words hover:underline">
              {order.customer_phone}
            </a>
          </p>
        )}
        <p className="flex items-start gap-2">
          <Package className="mt-0.5 h-4 w-4 shrink-0 text-lime-400/70" />
          <span className="min-w-0 break-words">
            {order.order_items?.length ?? 0} item{(order.order_items?.length ?? 0) > 1 ? "s" : ""} ·{" "}
            {formatCurrency(order.total_amount, currency)} ·{" "}
            {prepaid ? "PREPAID" : order.payment_method.toUpperCase()}
          </span>
        </p>
        {prepaid && (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-lime-400/10 px-2.5 py-1 text-xs font-semibold text-lime-300">
            <Wallet className="h-3.5 w-3.5" /> Paid by wallet · collect nothing
          </p>
        )}
      </div>

      {order.order_items && order.order_items.length > 0 && (
        <div className="mt-2 rounded-lg bg-black/30 p-2 text-xs text-stone-500">
          {order.order_items.map((it) => (
            <span key={it.id} className="mr-2">
              {it.product_name} ×{it.quantity}
            </span>
          ))}
        </div>
      )}

      <DeliveryActions
        order={order}
        currency={currency}
        detailsHref={`/orders/${order.id}?from=delivery`}
        className="mt-3 border-t border-white/5 pt-3"
      />
    </div>
  );
}
