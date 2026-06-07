import type { OrderStatus, OrderType, SettingsMap } from "@/lib/types";

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Tailwind classes for status pills (works on light & dark). */
export const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  preparing: "bg-indigo-100 text-indigo-800 border-indigo-200",
  out_for_delivery: "bg-purple-100 text-purple-800 border-purple-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

/** Next status options in the flow, given current status & order type. */
export function nextStatuses(current: OrderStatus, type: OrderType): OrderStatus[] {
  const pickupFlow: OrderStatus[] = ["pending", "confirmed", "preparing", "delivered"];
  const deliveryFlow: OrderStatus[] = [
    "pending",
    "confirmed",
    "preparing",
    "out_for_delivery",
    "delivered",
  ];
  const flow = type === "delivery" ? deliveryFlow : pickupFlow;
  const idx = flow.indexOf(current);
  const forward = idx >= 0 && idx < flow.length - 1 ? [flow[idx + 1]] : [];
  // Always allow cancellation unless already delivered/cancelled.
  if (current !== "delivered" && current !== "cancelled") forward.push("cancelled");
  return forward;
}

/** Computes the delivery fee split from dynamic settings. */
export function deliverySplit(settings: SettingsMap, orderType: OrderType) {
  if (orderType !== "delivery") {
    return { delivery_fee: 0, delivery_person_earning: 0, admin_delivery_earning: 0 };
  }
  const delivery_fee = Number(settings.delivery_fee ?? 10);
  const delivery_person_earning = Number(settings.delivery_person_share ?? 8);
  const admin_delivery_earning = Number(
    settings.admin_delivery_share ?? delivery_fee - delivery_person_earning
  );
  return { delivery_fee, delivery_person_earning, admin_delivery_earning };
}

/** Confirming an order deducts stock; cancelling a confirmed order restores it. */
export function statusDeductsStock(status: OrderStatus): boolean {
  return status !== "pending" && status !== "cancelled";
}
