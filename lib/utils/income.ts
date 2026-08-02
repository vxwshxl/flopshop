import type { IncomeMethod } from "@/lib/types";

/** Income payment-method buckets, in display order. Keys match the income
 *  aggregation in Reports and the method_transfer_legs `method` values. */
export const INCOME_METHODS: { key: IncomeMethod; label: string }[] = [
  { key: "cash", label: "Cash" },
  { key: "upi", label: "UPI" },
  { key: "bank", label: "Bank Transfer" },
  { key: "credit", label: "Wallet/Credit" },
  { key: "other", label: "Other" },
];

export const INCOME_METHOD_LABEL: Record<IncomeMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  bank: "Bank Transfer",
  credit: "Wallet/Credit",
  other: "Other",
};

/** How a wallet's credit was funded, as shares of 1. */
export type SourceMix = { cash: number; upi: number; bank: number; other: number };

/** The shape Reports needs to re-attribute credit spend to its funding source. */
export interface CreditSources {
  /** order id → funding mix of the wallet that paid it. */
  byOrder: Record<string, SourceMix>;
  /** Used when an order's paying wallet is unknown or has no inflow history. */
  fallback: SourceMix;
}

const UNKNOWN_MIX: SourceMix = { cash: 0, upi: 0, bank: 0, other: 1 };

/** One row of the wallet ledger, trimmed to what the attribution needs. */
export interface LedgerRow {
  order_id: string | null;
  wallet_id: string;
  amount: number | string;
  type: string;
  method: string | null;
}

function normalize(m: SourceMix): SourceMix | null {
  const total = m.cash + m.upi + m.bank + m.other;
  if (total <= 0) return null;
  return { cash: m.cash / total, upi: m.upi / total, bank: m.bank / total, other: m.other / total };
}

/**
 * Work out where each credit-paid order's money originally came from.
 *
 * Money enters a wallet as a cash/UPI/bank top-up, or as change the customer
 * left at the door (always cash). None of that is booked as income at the time —
 * it only counts when spent — so re-attributing credit spend to its funding
 * method doesn't double-count anything.
 *
 * A wallet's spend is attributed to its inflow mix as a whole rather than
 * matched inflow-to-outflow: money in a wallet is fungible, and per-order FIFO
 * would imply a precision the ledger doesn't actually carry.
 */
export function buildCreditSources(rows: LedgerRow[]): CreditSources {
  const inflow = new Map<string, SourceMix>();
  const shopWide: SourceMix = { cash: 0, upi: 0, bank: 0, other: 0 };
  // order id → the wallet that was debited for it.
  const payingWallet = new Map<string, string>();

  for (const r of rows) {
    const amount = Number(r.amount);
    if (!Number.isFinite(amount)) continue;

    if (amount > 0) {
      const key: keyof SourceMix =
        r.method === "cash" || r.type === "change"
          ? "cash"
          : r.method === "upi"
            ? "upi"
            : r.method === "bank"
              ? "bank"
              : "other";
      const m = inflow.get(r.wallet_id) ?? { cash: 0, upi: 0, bank: 0, other: 0 };
      m[key] += amount;
      inflow.set(r.wallet_id, m);
      shopWide[key] += amount;
      continue;
    }

    // A debit tagged with an order is that order being paid from the wallet —
    // either the direct charge or the negative leg of a settlement adjustment.
    if (amount < 0 && r.order_id && (r.type === "order_payment" || r.type === "adjustment")) {
      payingWallet.set(r.order_id, r.wallet_id);
    }
  }

  const fractions = new Map<string, SourceMix>();
  for (const [walletId, m] of inflow) {
    const f = normalize(m);
    if (f) fractions.set(walletId, f);
  }

  const byOrder: Record<string, SourceMix> = {};
  for (const [orderId, walletId] of payingWallet) {
    const f = fractions.get(walletId);
    if (f) byOrder[orderId] = f;
  }

  return { byOrder, fallback: normalize(shopWide) ?? UNKNOWN_MIX };
}
