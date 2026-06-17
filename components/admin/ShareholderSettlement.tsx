"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import { SHAREHOLDERS, splitProfit, type ShareholderKey } from "@/lib/utils/shareholders";
import { settleShareholdersAction } from "@/app/admin/shareholders/actions";

export type ProfitSettlementRow = {
  id: string;
  profit_base: number;
  settled_through: string;
  philip_amount: number;
  zau_amount: number;
  vee_amount: number;
  note: string | null;
  created_at: string;
};

export function ShareholderSettlement({
  outstanding,
  history,
  currency,
}: {
  outstanding: number;
  history: ProfitSettlementRow[];
  currency: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, startTransition] = useTransition();

  const split = splitProfit(outstanding);
  const pag = usePagination(history);

  function settle() {
    startTransition(async () => {
      const res = await settleShareholdersAction({ note });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Distributed ${formatCurrency(res.pool, currency)} to shareholders.`);
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="glass mt-4 rounded-2xl">
      <div className="glass-line flex items-center gap-2 border-b px-4 py-3">
        <Users className="h-4 w-4 text-yellow-400" />
        <h3 className="text-sm font-bold text-stone-900 dark:text-white">Settle profit to shareholders</h3>
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-500">Profit balance</span>
            <span className="text-xl font-extrabold text-stone-900 dark:text-white">
              {formatCurrency(outstanding, currency)}
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500">Distributable profit since last settlement</p>

          {outstanding > 0 ? (
            <div className="mt-4 space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                {SHAREHOLDERS.map((sh) => (
                  <div
                    key={sh.key}
                    className="rounded-lg border border-black/10 px-3 py-2.5 dark:border-white/10"
                  >
                    <div className="flex items-center justify-between text-xs text-stone-500">
                      <span className="font-medium text-stone-700 dark:text-stone-300">{sh.name}</span>
                      <span>{sh.rate * 100}%</span>
                    </div>
                    <p className="mt-0.5 text-base font-bold text-stone-900 dark:text-white">
                      {formatCurrency(split[sh.key as ShareholderKey], currency)}
                    </p>
                  </div>
                ))}
              </div>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
              <Button disabled={busy} onClick={settle} className="w-full sm:w-auto">
                Settle &amp; reset · {formatCurrency(outstanding, currency)}
              </Button>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Records the payout with a timestamp and resets the profit balance to zero.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-stone-500">Nothing to settle — the profit balance is zero.</p>
          )}
        </div>

        {history.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Withdrawal history ({history.length})
            </p>
            <div className="space-y-2">
              {pag.pageItems.map((h) => (
                <div key={h.id} className="rounded-lg border border-black/10 px-3 py-2.5 dark:border-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-stone-900 dark:text-white">
                      {formatCurrency(Number(h.profit_base), currency)} distributed
                    </span>
                    <span className="text-xs text-stone-500">{formatDateTime(h.created_at)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-stone-500">
                    <span>Philip {formatCurrency(Number(h.philip_amount), currency)}</span>
                    <span>Zau {formatCurrency(Number(h.zau_amount), currency)}</span>
                    <span>Vee {formatCurrency(Number(h.vee_amount), currency)}</span>
                  </div>
                  {h.note && (
                    <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">“{h.note}”</p>
                  )}
                </div>
              ))}
            </div>
            <Pagination
              page={pag.page}
              totalPages={pag.totalPages}
              perPage={pag.perPage}
              total={pag.total}
              onPage={pag.setPage}
              onPerPage={pag.setPerPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
