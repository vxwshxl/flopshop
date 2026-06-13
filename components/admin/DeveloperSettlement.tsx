"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import { settleDeveloperAction } from "@/app/admin/developer/actions";

export type DevSettlementRow = {
  id: string;
  amount: number;
  profit_base: number;
  settled_through: string;
  note: string | null;
  created_at: string;
};

export function DeveloperSettlement({
  outstanding,
  outstandingBase,
  history,
  currency,
}: {
  outstanding: number;
  outstandingBase: number;
  history: DevSettlementRow[];
  currency: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, startTransition] = useTransition();

  function settle() {
    startTransition(async () => {
      const res = await settleDeveloperAction(note);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Settled ${formatCurrency(res.amount, currency)} to developer.`);
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="glass mt-4 rounded-2xl">
      <div className="glass-line flex items-center gap-2 border-b px-4 py-3">
        <HandCoins className="h-4 w-4 text-yellow-400" />
        <h3 className="text-sm font-bold text-stone-900 dark:text-white">Settle developer share</h3>
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded-xl border border-black/10 p-3 dark:border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-500">Outstanding share</span>
            <span className="text-xl font-extrabold text-stone-900 dark:text-white">
              {formatCurrency(outstanding, currency)}
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500">10% of {formatCurrency(outstandingBase, currency)} profit since last settlement</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="flex-1" />
            <Button disabled={busy || outstanding <= 0} onClick={settle}>
              Settle up
            </Button>
          </div>
          {outstanding <= 0 && (
            <p className="mt-2 text-xs text-stone-500">Nothing outstanding — all share is settled.</p>
          )}
        </div>

        {history.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Settlement history</p>
            <div className="space-y-2">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"
                >
                  <div>
                    <p className="font-medium text-stone-900 dark:text-white">
                      {formatCurrency(Number(h.amount), currency)} settled
                    </p>
                    <p className="text-xs text-stone-500">
                      {formatDateTime(h.created_at)} · 10% of {formatCurrency(Number(h.profit_base), currency)}
                      {h.note ? ` · ${h.note}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
