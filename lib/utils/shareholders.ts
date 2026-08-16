import { istDateString } from "@/lib/utils/formatters";

/**
 * Shareholder profit distribution. The shop's profit (item gross margin + the
 * shop's delivery share) is split by each shareholder's `share_percent` (the
 * roster lives in the `shareholders` table). A shareholder may also have a
 * `profit_from` date floor — they only earn on profit from that date onward
 * (e.g. the developer joined later). Others with no floor earn all-time.
 *
 * Settlements record a `settled_through` cutoff; the outstanding balance is the
 * profit accrued over orders created AFTER the latest settlement (or all-time
 * when nothing has been settled yet), so settling resets the balance to zero.
 *
 * A settlement may pay out less than the balance (partial settlement). The
 * remainder is stored on that settlement as `carry_forward` and added back on
 * top of the profit accrued since its cutoff — otherwise the change left behind
 * would be lost when the cutoff moves forward.
 */
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
 * otherwise all-time profit counts. Cancelled orders are always excluded.
 */
export function computeProfitPool(orders: ProfitOrder[], sinceIso?: string | null): number {
  return orders.reduce((sum, o) => {
    if (o.status === "cancelled") return sum;
    if (sinceIso && o.created_at <= sinceIso) return sum;
    return sum + orderProfit(o);
  }, 0);
}

/** Total of the given shareholders' percentages, rounded to 2 decimals. */
export function totalPercent(holders: { share_percent: number | string }[]): number {
  return Number(holders.reduce((s, h) => s + Number(h.share_percent), 0).toFixed(2));
}

export interface ProfitHolder {
  id?: string;
  share_percent: number | string;
  /** Only profit on/after this IST date (YYYY-MM-DD) counts for this holder. */
  profit_from?: string | null;
}

export interface HolderShare {
  /** Profit pool accrued to this holder since their cutoff. */
  base: number;
  /** Their percentage cut of `base`. */
  share: number;
  /** Change left unpaid by their last (partial) settlement. */
  carry: number;
  /** What they are actually owed now: `share` + `carry`. */
  amount: number;
}

/**
 * One shareholder's outstanding profit since `sinceIso` (their last settlement
 * cutoff, or null for all-time), plus any `carry` left unpaid by that
 * settlement. Profit is also floored by the holder's own `profit_from` date.
 */
export function shareholderShare(
  orders: ProfitOrder[],
  holder: ProfitHolder,
  sinceIso?: string | null,
  carry: number = 0
): HolderShare {
  const r = (n: number) => Number(n.toFixed(2));
  const base = orders.reduce((sum, o) => {
    if (o.status === "cancelled") return sum;
    if (sinceIso && o.created_at <= sinceIso) return sum;
    if (holder.profit_from && istDateString(o.created_at) < holder.profit_from) return sum;
    return sum + orderProfit(o);
  }, 0);
  const share = r((base * Number(holder.share_percent)) / 100);
  const carried = r(Number(carry) || 0);
  return { base: r(base), share, carry: carried, amount: r(share + carried) };
}

/**
 * Outstanding profit per shareholder. Each holder is settled independently, so
 * `cutoffById` maps a shareholder id to their last settlement cutoff and
 * `carryById` to that settlement's unpaid remainder; holders not present accrue
 * all-time (still floored by their own `profit_from`).
 */
export function distributeProfit<T extends ProfitHolder>(
  orders: ProfitOrder[],
  holders: T[],
  cutoffById?: Record<string, string | null>,
  carryById?: Record<string, number>
): (T & HolderShare)[] {
  return holders.map((h) => {
    const sinceIso = (h.id && cutoffById?.[h.id]) || null;
    const carry = (h.id && carryById?.[h.id]) || 0;
    return { ...h, ...shareholderShare(orders, h, sinceIso, carry) };
  });
}
