"use client";

import toast from "react-hot-toast";
import { Bike } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";

export interface NewOrderInfo {
  order_number?: string | null;
  customer_name?: string | null;
  customer_room?: string | null;
  total_amount?: number | null;
  is_manual?: boolean | null;
}

/**
 * Bottom toast shown on the admin/delivery dashboards when a new delivery order
 * arrives. Lives for 5s with a yellow progress bar that drains over that time
 * (see `.toast-progress` in globals.css). Paired with the order chime.
 */
export function notifyNewOrder(order: NewOrderInfo) {
  const room = order.customer_room?.trim();
  const amount = Number(order.total_amount ?? 0);

  toast.custom(
    (t) => (
      <div
        className={`pointer-events-auto w-[340px] max-w-[90vw] overflow-hidden rounded-xl border border-amber-500/40 bg-[#111] shadow-2xl shadow-black/50 transition-all duration-300 ${
          t.visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <div className="flex items-start gap-3 p-4">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
            <Bike className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">New delivery order</p>
            <p className="mt-0.5 truncate text-xs text-gray-400">
              {order.customer_name || "Customer"}
              {room ? ` · Room ${room}` : ""}
              {order.order_number ? ` · #${order.order_number}` : ""}
            </p>
          </div>
          {amount > 0 && (
            <span className="shrink-0 text-sm font-semibold text-amber-400">
              {formatCurrency(amount)}
            </span>
          )}
        </div>
        <div className="h-1 w-full bg-white/5">
          <div className="toast-progress h-full bg-amber-400" />
        </div>
      </div>
    ),
    { duration: 5000, position: "bottom-center" }
  );
}
