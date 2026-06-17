import { istDateString } from "@/lib/utils/formatters";

/**
 * Shareholder profit distribution. The shop's profit (item gross margin + the
 * shop's delivery share) is owned in full by the three shareholders and split
 * Philip 50% / Zau 40% / Vee 10%. Vee's 10% IS the old "developer share" — this
 * model supersedes the developer settlement flow.
 *
 * Settlements record a `settled_through` cutoff; the outstanding balance is the
 * pool accrued over orders created AFTER the latest settlement (falling back to
 * PROFIT_START), so settling resets the balance to zero.
 */
export const PROFIT_START = "2026-06-10";
export const PROFIT_START_LABEL = "10 Jun, 2026";

export type ShareholderKey = "philip" | "zau" | "vee";

export const SHAREHOLDERS: { key: ShareholderKey; name: string; rate: number }[] = [
  { key: "philip", name: "Philip", rate: 0.5 },
  { key: "zau", name: "Zau", rate: 0.4 },
  { key: "vee", name: "Vee", rate: 0.1 },
];

export interface ProfitOrder {
  created_at: string;
  status?: string;
  subtotal: number | string;
  admin_delivery_earning: number | string;
  order_items: { quantity: number; cost_price: number | string | null }[];
}

/** Profit contributed by one order (item margin + shop delivery share). */
export function orderProfit(o: ProfitOrder): number {
  const itemsCost = o.order_items.reduce(
    (a, it) => a + it.quantity * Number(it.cost_price ?? 0),
    0
  );
  return Number(o.subtotal) - itemsCost + Number(o.admin_delivery_earning);
}

/**
 * Outstanding profit pool over the given orders. When `sinceIso` is provided
 * (the last settlement cutoff), only orders created strictly after it count;
 * otherwise everything from PROFIT_START onwards counts. Cancelled orders are
 * always excluded.
 */
export function computeProfitPool(orders: ProfitOrder[], sinceIso?: string | null): number {
  return orders.reduce((sum, o) => {
    if (o.status === "cancelled") return sum;
    if (sinceIso) {
      if (o.created_at <= sinceIso) return sum;
    } else if (istDateString(o.created_at) < PROFIT_START) {
      return sum;
    }
    return sum + orderProfit(o);
  }, 0);
}

/**
 * Split a profit pool among shareholders, rounded to 2 decimals. Philip absorbs
 * any rounding remainder so the three amounts always sum back to the pool.
 */
export function splitProfit(pool: number): Record<ShareholderKey, number> {
  const r = (n: number) => Number(n.toFixed(2));
  const zau = r(pool * 0.4);
  const vee = r(pool * 0.1);
  const philip = r(pool - zau - vee);
  return { philip, zau, vee };
}
