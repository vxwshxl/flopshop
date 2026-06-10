import type { OrderStatus, OrderType, SettingsMap } from "@/lib/types";

/** Methods an admin can switch an order to. Stored lowercase to match how the
 *  reports bucket income (Cash / UPI / Bank Transfer / Other). */
export const EDITABLE_PAYMENT_METHODS = ["cash", "upi", "bank transfer", "other"] as const;

/** Cash-on-delivery ceiling. Delivery orders above this must be paid by UPI —
 *  we don't want partners carrying large cash amounts / risking non-payment. */
export const COD_MAX = 1000;
export type EditablePaymentMethod = (typeof EDITABLE_PAYMENT_METHODS)[number];

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
  pending: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-400/15 dark:text-amber-200 dark:border-amber-400/20",
  confirmed: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-400/15 dark:text-sky-200 dark:border-sky-400/20",
  preparing: "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-400/15 dark:text-lime-200 dark:border-lime-400/20",
  out_for_delivery: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-400/15 dark:text-violet-200 dark:border-violet-400/20",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-400/15 dark:text-emerald-200 dark:border-emerald-400/20",
  cancelled: "bg-red-100 text-red-800 border-red-200 dark:bg-red-400/15 dark:text-red-200 dark:border-red-400/20",
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

/** Statuses an admin may set directly. For delivery orders, dispatch and
 *  completion are reserved for the assigned delivery partner. */
export function adminSettableStatuses(type: OrderType): OrderStatus[] {
  return type === "delivery"
    ? ORDER_STATUSES.filter((s) => s !== "out_for_delivery" && s !== "delivered")
    : ORDER_STATUSES;
}

/** Label for a status that reads correctly for pickup ("Completed") vs delivery. */
export function statusLabel(status: OrderStatus, type: OrderType): string {
  if (status === "delivered" && type !== "delivery") return "Completed";
  return STATUS_LABELS[status];
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
