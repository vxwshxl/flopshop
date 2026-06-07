"use client";

import { useTransition } from "react";
import { MapPin, Phone, Package } from "lucide-react";
import toast from "react-hot-toast";
import { setOrderStatusAction } from "@/app/admin/orders/actions";
import { OrderStatusBadge } from "@/components/store/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatTime } from "@/lib/utils/formatters";
import type { Order } from "@/lib/types";

export function DeliveryCard({ order, currency }: { order: Order; currency: string }) {
  const [pending, startTransition] = useTransition();

  function update(status: "out_for_delivery" | "delivered") {
    startTransition(async () => {
      const res = await setOrderStatusAction(order.id, status);
      if (!res.ok) toast.error(res.error ?? "Failed");
      else toast.success(status === "delivered" ? "Marked delivered 🎉" : "Out for delivery");
    });
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1d23] p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-white">{order.order_number}</p>
          <p className="text-xs text-gray-500">{formatTime(order.created_at)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-gray-300">
        <p className="font-medium text-white">{order.customer_name}</p>
        {order.customer_room && (
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-indigo-400" /> Room {order.customer_room}
          </p>
        )}
        {order.customer_phone && (
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-indigo-400" />
            <a href={`tel:${order.customer_phone}`} className="hover:underline">
              {order.customer_phone}
            </a>
          </p>
        )}
        <p className="flex items-center gap-2">
          <Package className="h-4 w-4 text-indigo-400" />
          {order.order_items?.length ?? 0} item{(order.order_items?.length ?? 0) > 1 ? "s" : ""} ·{" "}
          {formatCurrency(order.total_amount, currency)} · {order.payment_method.toUpperCase()}
        </p>
      </div>

      {order.order_items && order.order_items.length > 0 && (
        <div className="mt-2 rounded-lg bg-black/30 p-2 text-xs text-gray-400">
          {order.order_items.map((it) => (
            <span key={it.id} className="mr-2">
              {it.product_name} ×{it.quantity}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-green-400">
          You earn {formatCurrency(order.delivery_person_earning, currency)}
        </span>
        <div className="flex gap-2">
          {order.status !== "out_for_delivery" && order.status !== "delivered" && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => update("out_for_delivery")}>
              Pick up
            </Button>
          )}
          {order.status !== "delivered" && (
            <Button size="sm" disabled={pending} onClick={() => update("delivered")}>
              Mark delivered
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
