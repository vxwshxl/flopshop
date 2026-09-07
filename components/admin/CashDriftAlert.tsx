"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { reconcileWalletCashDriftAction } from "@/app/admin/reports/actions";
import type { CashDrift } from "@/lib/utils/cash-drift";

/**
 * Flags cash that went out of the drawer to repay credit the shop was paid for
 * by UPI or bank, and offers to book the Income Transfer that squares it off.
 *
 * Deliberately worded for someone who reads the report, not someone who reads
 * the ledger: the point to land is "your drawer and this number disagree, and
 * here is the one click that fixes it".
 */
export function CashDriftAlert({ drift, currency }: { drift: CashDrift; currency: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (drift.total < 0.5) return null;

  const latest = drift.days[drift.days.length - 1];

  async function reconcile() {
    setBusy(true);
    const res = await reconcileWalletCashDriftAction();
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(
      `Recorded ${formatCurrency(res.amount, currency)} across ${res.created} ${res.created === 1 ? "day" : "days"}.`
    );
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-400/25 dark:bg-amber-400/10">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-400 text-black">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="text-sm font-bold text-stone-900 dark:text-white">
            Your cash drawer is {formatCurrency(drift.total, currency)} lighter than Cash Income says
          </h3>
          <p className="text-sm text-stone-700 dark:text-stone-300">
            Customers topped up their store credit by UPI or bank transfer and took that money back
            out as cash. Neither half is a sale, so the income split never noticed — but the shop
            really did swap its own cash for their UPI money.
          </p>

          <div className="flex flex-wrap gap-2 pt-0.5">
            {drift.upi >= 0.5 && <DriftLeg to="UPI" amount={drift.upi} currency={currency} />}
            {drift.bank >= 0.5 && <DriftLeg to="Bank" amount={drift.bank} currency={currency} />}
          </div>

          <p className="text-xs text-stone-600 dark:text-stone-400">
            Across {drift.days.length} {drift.days.length === 1 ? "day" : "days"}
            {latest ? `, most recently ${formatDate(latest.date)}` : null}. Recording it moves the
            amount between the two figures without changing your total income, and each entry is
            dated to the day the cash went out so past reports stay right. It shows up under Income
            Transfers below, where you can undo it.
          </p>
        </div>
        <Button onClick={reconcile} loading={busy} className="shrink-0">
          Record the transfer
        </Button>
      </div>
    </div>
  );
}

function DriftLeg({ to, amount, currency }: { to: string; amount: number; currency: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-white/60 px-2.5 py-1 text-sm font-semibold text-stone-800 dark:bg-black/30 dark:text-stone-100">
      Cash <ArrowRight className="h-3.5 w-3.5 text-stone-500" /> {to}
      <span className="num">{formatCurrency(amount, currency)}</span>
    </span>
  );
}
