import { istDateString } from "@/lib/utils/formatters";
import type { MethodTransfer } from "@/lib/types";

/**
 * Cash that left the drawer to repay store credit the shop never received in
 * cash.
 *
 * A customer tops up ₹55 by UPI and asks for ₹55 in cash back. Neither leg is a
 * sale, so neither touches income — but the shop's UPI really is ₹55 up and its
 * drawer really is ₹55 down. "Cash Income" then reads high and "UPI Income"
 * reads low against the money actually in hand, and nothing in the app says so.
 * The fix already exists (an Income Transfer moving cash → UPI); this works out
 * how much of one is outstanding.
 */

/** Note stamped on the transfers this reconciliation writes, so a later run can
 *  tell what it has already settled from what an admin entered by hand. */
export const CASH_DRIFT_NOTE = "Wallet cash-out reconciliation";

export function isCashDriftTransfer(t: { note: string | null }): boolean {
  return (t.note ?? "").startsWith(CASH_DRIFT_NOTE);
}

/** One wallet ledger row, trimmed to what the drift walk needs. */
export interface DriftLedgerRow {
  wallet_id: string;
  amount: number | string;
  type: string;
  method: string | null;
  created_at: string;
}

/** Non-cash-funded cash paid out on one IST day. */
export interface CashDriftDay {
  /** YYYY-MM-DD (IST) — the day the cash left the drawer. */
  date: string;
  upi: number;
  bank: number;
}

export interface CashDrift {
  /** Days still needing a transfer, oldest first. */
  days: CashDriftDay[];
  upi: number;
  bank: number;
  total: number;
}

type Pool = { cash: number; upi: number; bank: number; other: number };
const POOL_KEYS: (keyof Pool)[] = ["cash", "upi", "bank", "other"];

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Which kind of money an inflow was. Matches `buildCreditSources` so both
 * readings of the ledger agree on what "UPI money" means — change left at the
 * door is always cash, and anything unlabelled (a wallet-to-wallet transfer in,
 * a manual adjustment) is `other`, which never produces drift.
 */
function bucketOf(row: DriftLedgerRow): keyof Pool {
  if (row.method === "cash" || row.type === "change") return "cash";
  if (row.method === "upi") return "upi";
  if (row.method === "bank") return "bank";
  return "other";
}

/**
 * Walk each wallet in time order, carrying a running pool of what its balance
 * is made of. Every debit — an order paid on credit, a transfer out, a cash
 * withdrawal — draws from that pool in proportion to what's currently in it, so
 * a customer who spent last month's cash top-up and then tops up ₹55 by UPI
 * today is correctly read as withdrawing UPI money today.
 *
 * A running pool rather than `buildCreditSources`' whole-history mix, because
 * the two answer different questions: that one attributes a wallet's lifetime
 * spend, this one has to catch a single same-day top-up-and-take-cash.
 */
export function computeCashDrift(
  rows: DriftLedgerRow[],
  transfers: MethodTransfer[]
): CashDrift {
  const byWallet = new Map<string, DriftLedgerRow[]>();
  for (const r of rows) {
    const list = byWallet.get(r.wallet_id);
    if (list) list.push(r);
    else byWallet.set(r.wallet_id, [r]);
  }

  // IST day → cash paid out that was funded by UPI / bank money.
  const raw = new Map<string, { upi: number; bank: number }>();

  for (const list of byWallet.values()) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const pool: Pool = { cash: 0, upi: 0, bank: 0, other: 0 };

    for (const r of list) {
      const amount = Number(r.amount);
      if (!Number.isFinite(amount) || amount === 0) continue;
      if (amount > 0) {
        pool[bucketOf(r)] += amount;
        continue;
      }

      const held = pool.cash + pool.upi + pool.bank + pool.other;
      // Spending into debt: there's nothing in the pool to attribute it to.
      if (held <= 0) continue;
      const drawn = Math.min(-amount, held);
      const used: Pool = { cash: 0, upi: 0, bank: 0, other: 0 };
      for (const k of POOL_KEYS) {
        const part = drawn * (pool[k] / held);
        pool[k] -= part;
        used[k] = part;
      }

      if (r.type !== "withdrawal") continue;
      const day = istDateString(r.created_at);
      const acc = raw.get(day) ?? { upi: 0, bank: 0 };
      acc.upi += used.upi;
      acc.bank += used.bank;
      raw.set(day, acc);
    }
  }

  // What earlier runs already booked, matched by the day they were dated to, so
  // a fresh withdrawal on an already-reconciled day still gets picked up.
  const settled = new Map<string, { upi: number; bank: number }>();
  for (const t of transfers) {
    if (!isCashDriftTransfer(t)) continue;
    const acc = settled.get(t.date) ?? { upi: 0, bank: 0 };
    for (const leg of t.legs ?? []) {
      const delta = Number(leg.delta);
      if (delta <= 0) continue;
      if (leg.method === "upi") acc.upi += delta;
      else if (leg.method === "bank") acc.bank += delta;
    }
    settled.set(t.date, acc);
  }

  const days: CashDriftDay[] = [];
  let upi = 0;
  let bank = 0;
  for (const [date, v] of [...raw.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const done = settled.get(date) ?? { upi: 0, bank: 0 };
    const u = round2(Math.max(0, v.upi - done.upi));
    const b = round2(Math.max(0, v.bank - done.bank));
    // Sub-rupee remainders are rounding noise, not something to nag about.
    if (u + b < 0.5) continue;
    days.push({ date, upi: u, bank: b });
    upi += u;
    bank += b;
  }

  return { days, upi: round2(upi), bank: round2(bank), total: round2(upi + bank) };
}

/** Empty drift — the shape to fall back on when nothing has been computed. */
export const NO_CASH_DRIFT: CashDrift = { days: [], upi: 0, bank: 0, total: 0 };
