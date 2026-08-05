import { istDateString } from "@/lib/utils/formatters";
import type { OrderStatus, OrderType, SettingsMap } from "@/lib/types";

/** Methods an admin can switch an order to. Stored lowercase to match how the
 *  reports bucket income (Cash / UPI / Bank Transfer / Other). */
export const EDITABLE_PAYMENT_METHODS = ["cash", "upi", "bank transfer", "other"] as const;

/** Cash-on-delivery ceiling. Delivery orders above this must be paid by UPI —
 *  we don't want partners carrying large cash amounts / risking non-payment. */
export const COD_MAX = 1000;

/** Largest difference a delivery partner may settle into the customer's wallet
 *  when they have no change. Sized to the biggest note in circulation (₹500), so
 *  a customer paying a small order with one is still covered; beyond that it's
 *  more likely a typo than a real handover, and has to be paid exactly or by
 *  shop QR. */
export const DOOR_CHANGE_MAX = 500;
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

/**
 * Free-delivery promo: is it running, and does this basket qualify?
 *
 * Driven entirely by settings so the promo can be extended or stopped from the
 * admin Settings page without a deploy:
 *   free_delivery_min    — subtotal (goods only, before the fee) that qualifies.
 *                          "0" or blank switches the promo off.
 *   free_delivery_until  — last day it runs, as an IST YYYY-MM-DD date,
 *                          inclusive. Blank means no end date.
 */
export function freeDeliveryPromo(settings: SettingsMap) {
  const min = Number(settings.free_delivery_min ?? 0);
  const until = (settings.free_delivery_until ?? "").trim();
  // ISO dates compare correctly as plain strings.
  const live = min > 0 && (!until || istDateString() <= until);
  return { live, min, until };
}

/** True when this order's goods total earns free delivery today. */
export function qualifiesForFreeDelivery(settings: SettingsMap, subtotal: number): boolean {
  const promo = freeDeliveryPromo(settings);
  return promo.live && subtotal >= promo.min;
}

/**
 * Computes the delivery fee split from dynamic settings.
 *
 * `subtotal` is the goods total, needed for the free-delivery promo. When the
 * promo applies the customer pays no fee, but the delivery partner is still paid
 * their usual share — so the shop's delivery earning goes NEGATIVE by that
 * amount. That's deliberate: it flows straight through reports and the
 * shareholder profit pool as the cost of the promo.
 */
export function deliverySplit(settings: SettingsMap, orderType: OrderType, subtotal: number) {
  if (orderType !== "delivery") {
    return { delivery_fee: 0, delivery_person_earning: 0, admin_delivery_earning: 0 };
  }
  const delivery_fee = Number(settings.delivery_fee ?? 10);
  const delivery_person_earning = Number(settings.delivery_person_share ?? 8);
  const admin_delivery_earning = Number(
    settings.admin_delivery_share ?? delivery_fee - delivery_person_earning
  );

  if (qualifiesForFreeDelivery(settings, subtotal)) {
    return {
      delivery_fee: 0,
      delivery_person_earning,
      admin_delivery_earning: -delivery_person_earning,
    };
  }
  return { delivery_fee, delivery_person_earning, admin_delivery_earning };
}

/** What the customer is charged for delivery on this basket (0 during the promo). */
export function deliveryFeeFor(settings: SettingsMap, orderType: OrderType, subtotal: number): number {
  return deliverySplit(settings, orderType, subtotal).delivery_fee;
}

/** Confirming an order deducts stock; cancelling a confirmed order restores it. */
export function statusDeductsStock(status: OrderStatus): boolean {
  return status !== "pending" && status !== "cancelled";
}
