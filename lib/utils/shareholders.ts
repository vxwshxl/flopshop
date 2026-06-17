/**
 * Shareholder profit distribution. The shop's profit (item gross margin + the
 * shop's delivery share) is owned in full by the shareholders and split by each
 * shareholder's `share_percent` (the roster lives in the `shareholders` table).
 *
 * Settlements record a `settled_through` cutoff; the outstanding balance is the
 * pool accrued over orders created AFTER the latest settlement (or all-time when
 * nothing has been settled yet), so settling resets the balance to zero.
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

/**
 * Split a profit pool among shareholders by their `share_percent`, rounded to 2
 * decimals. The largest-percent shareholder absorbs any rounding remainder so
 * the amounts sum back to the pool (assuming percentages total 100).
 */
export function splitPool<T extends { share_percent: number | string }>(
  pool: number,
  holders: T[]
): (T & { amount: number })[] {
  const r = (n: number) => Number(n.toFixed(2));
  const rows = holders.map((h) => ({ ...h, amount: r((pool * Number(h.share_percent)) / 100) }));
  if (rows.length) {
    const drift = r(r(pool) - r(rows.reduce((a, b) => a + b.amount, 0)));
    if (drift !== 0) {
      let idx = 0;
      rows.forEach((row, i) => {
        if (Number(row.share_percent) > Number(rows[idx].share_percent)) idx = i;
      });
      rows[idx].amount = r(rows[idx].amount + drift);
    }
  }
  return rows;
}
