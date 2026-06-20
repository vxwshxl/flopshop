"use client";

import { useState } from "react";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import type { WalletTransactionView, WalletTxnMethod, WalletTxnType } from "@/lib/types";

const TXN_LABELS: Record<WalletTxnType, string> = {
  change: "Change credit",
  topup: "Top-up",
  order_payment: "Order payment",
  refund: "Refund",
  adjustment: "Adjustment",
  withdrawal: "Cash withdrawal",
  transfer: "Transfer",
};

const METHOD_LABELS: Record<WalletTxnMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  bank: "Bank",
  transfer: "Transfer",
  other: "Other",
};

function title(t: WalletTransactionView): string {
  if (t.type === "transfer") {
    const dir = Number(t.amount) < 0 ? "to" : "from";
    return t.counterparty_name ? `Transfer ${dir} ${t.counterparty_name}` : "Transfer";
  }
  return TXN_LABELS[t.type];
}

/** Date · method · who did it · note — whichever are present. */
function meta(t: WalletTransactionView): string {
  const parts = [formatDateTime(t.created_at)];
  if (t.method && t.method !== "transfer") parts.push(METHOD_LABELS[t.method]);
  if (t.actor_name) parts.push(`by ${t.actor_name}`);
  if (t.note) parts.push(t.note);
  return parts.join(" · ");
}

/** Enriched wallet history with a "view all" expander. Shared by admin + store. */
export function WalletTxnList({
  transactions,
  currency,
  initial = 6,
}: {
  transactions: WalletTransactionView[];
  currency: string;
  initial?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  if (!transactions.length) return null;
  const shown = showAll ? transactions : transactions.slice(0, initial);

  return (
    <div className="space-y-1.5">
      {shown.map((t) => (
        <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
          <div className="min-w-0">
            <p className="font-medium text-stone-800 dark:text-stone-100">{title(t)}</p>
            <p className="truncate text-xs text-stone-500">{meta(t)}</p>
          </div>
          <span className={`shrink-0 font-semibold ${Number(t.amount) >= 0 ? "text-lime-500" : "text-amber-500"}`}>
            {Number(t.amount) >= 0 ? "+" : "−"}
            {formatCurrency(Math.abs(Number(t.amount)), currency)}
          </span>
        </div>
      ))}
      {transactions.length > initial && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="mt-1 text-xs font-medium text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
        >
          {showAll ? "Show less" : `View all ${transactions.length} transactions`}
        </button>
      )}
    </div>
  );
}
