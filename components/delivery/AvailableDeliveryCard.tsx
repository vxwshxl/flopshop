"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Truck, Package } from "lucide-react";
import { claimDeliveryOrderAction } from "@/app/admin/orders/actions";
import { OrderStatusBadge } from "@/components/store/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatTime } from "@/lib/utils/formatters";
import type { Order } from "@/lib/types";

export function AvailableDeliveryCard({ order, currency }: { order: Order; currency: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function claim() {
    startTransition(async () => {
      try {
        const res = await claimDeliveryOrderAction(order.id);
        if (!res.ok) {
          toast.error(res.error ?? "Failed to claim order.");
          return;
        }
        toast.success("Order claimed. Head to pickup now.");
        router.refresh();
      } catch {
        toast.error("Unable to claim order. Please try again.");
      }
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
        <p className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-indigo-400" />
          Room {order.customer_room ?? "—"}
        </p>
        <p className="flex items-center gap-2">
          <Package className="h-4 w-4 text-indigo-400" />
          {order.order_items?.length ?? 0} item{(order.order_items?.length ?? 0) > 1 ? "s" : ""} · {formatCurrency(order.total_amount, currency)}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <Button size="sm" disabled={pending} onClick={claim} className="w-full">
          Claim order
        </Button>
      </div>
    </div>
  );
}
