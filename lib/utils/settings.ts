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
};
