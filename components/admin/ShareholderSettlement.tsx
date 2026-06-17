"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import { splitPool, totalPercent } from "@/lib/utils/shareholders";
import { settleShareholdersAction } from "@/app/admin/shareholders/actions";
import type { Shareholder } from "@/lib/types";

export type SettlementShareRow = {
  id: string;
  name: string;
  type: string | null;
  share_percent: number;
  amount: number;
};

export type ProfitSettlementRow = {
  id: string;
  profit_base: number;
  settled_through: string;
  note: string | null;
  created_at: string;
  shares: SettlementShareRow[];
};

export function ShareholderSettlement({
  outstanding,
  shareholders,
  history,
  currency,
}: {
  outstanding: number;
  shareholders: Shareholder[];
  history: ProfitSettlementRow[];
  currency: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, startTransition] = useTransition();

  const total = totalPercent(shareholders);
  const balanced = Math.abs(total - 100) <= 0.01;
  const split = splitPool(outstanding, shareholders);
  const canSettle = outstanding > 0 && shareholders.length > 0 && balanced;
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
              {shareholders.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {split.map((sh) => (
                    <div key={sh.id} className="rounded-lg border border-black/10 px-3 py-2.5 dark:border-white/10">
                      <div className="flex items-center justify-between text-xs text-stone-500">
                        <span className="font-medium text-stone-700 dark:text-stone-300">{sh.name}</span>
                        <span>{Number(sh.share_percent)}%</span>
                      </div>
                      {sh.type && <p className="text-[11px] capitalize text-stone-400">{sh.type}</p>}
                      <p className="mt-0.5 text-base font-bold text-stone-900 dark:text-white">
                        {formatCurrency(sh.amount, currency)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-amber-500">Add shareholders below before settling.</p>
              )}

              {shareholders.length > 0 && !balanced && (
                <p className="text-xs text-amber-500">
                  Active shares total {total}% — they must add up to 100% to settle.
                </p>
              )}

              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
              <Button disabled={busy || !canSettle} onClick={settle} className="w-full sm:w-auto">
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
                    {h.shares.map((s) => (
                      <span key={s.id}>
                        {s.name} {formatCurrency(Number(s.amount), currency)}
                      </span>
                    ))}
                  </div>
                  {h.note && <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">“{h.note}”</p>}
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
