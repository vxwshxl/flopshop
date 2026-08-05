import type { SettingsMap, Setting } from "@/lib/types";

export function settingsToMap(rows: Pick<Setting, "key" | "value">[] | null): SettingsMap {
  const map: SettingsMap = {};
  (rows ?? []).forEach((r) => {
    map[r.key] = r.value;
  });
  return map;
}

export const DEFAULT_SETTINGS: SettingsMap = {
  shop_name: "FlopShop",
  shop_tagline: "Your Hostel Snack Shop",
  currency_symbol: "₹",
  delivery_fee: "10",
  delivery_person_share: "8",
  admin_delivery_share: "2",
  min_order_for_delivery: "0",
  shop_is_open: "true",
  // The whole app runs on India Standard Time (display + invoice/day logic).
  timezone: "Asia/Kolkata",
  // Which order types customers may choose in the cart (comma-separated).
  order_types_enabled: "pickup,delivery",
  // Free-delivery promo: baskets of ₹299+ ship free, with the delivery person's
  // share paid out of the shop's margin. Runs to the end of 2026-08-12 (IST).
  // Set free_delivery_min to "0" to switch it off. See freeDeliveryPromo().
  free_delivery_min: "299",
  free_delivery_until: "2026-08-12",
};
