"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { HandCoins, Banknote, Smartphone, Split as SplitIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import { settleDeveloperAction } from "@/app/admin/developer/actions";

type Method = "cash" | "upi" | "split";

export type DevSettlementRow = {
  id: string;
  amount: number;
  profit_base: number;
  settled_through: string;
  method: Method;
  paid_cash: number;
  paid_upi: number;
  note: string | null;
  created_at: string;
};

const METHOD_META: Record<Method, { label: string; icon: React.ElementType; cls: string }> = {
  cash: { label: "Cash", icon: Banknote, cls: "bg-emerald-500/15 text-emerald-500" },
  upi: { label: "UPI", icon: Smartphone, cls: "bg-sky-500/15 text-sky-500" },
  split: { label: "Split", icon: SplitIcon, cls: "bg-violet-500/15 text-violet-500" },
};

function MethodBadge({ method }: { method: Method }) {
  const m = METHOD_META[method] ?? METHOD_META.cash;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}

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
  const [method, setMethod] = useState<Method>("cash");
  const [cashPortion, setCashPortion] = useState("");
  const [busy, startTransition] = useTransition();

  // Split breakdown of the outstanding payout.
  const cashPaid =
    method === "cash"
      ? outstanding
      : method === "upi"
        ? 0
        : Math.min(Math.max(Number(cashPortion) || 0, 0), outstanding);
  const upiPaid = Math.max(outstanding - cashPaid, 0);

  const pag = usePagination(history);

  function settle() {
    startTransition(async () => {
      const res = await settleDeveloperAction({
        note,
        method,
        ...(method === "split" ? { cashPortion: cashPaid } : {}),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Settled ${formatCurrency(res.amount, currency)} to developer.`);
      setNote("");
      setCashPortion("");
      setMethod("cash");
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
        <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-500">Outstanding share</span>
            <span className="text-xl font-extrabold text-stone-900 dark:text-white">
              {formatCurrency(outstanding, currency)}
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500">
            10% of {formatCurrency(outstandingBase, currency)} profit since last settlement
          </p>

          {outstanding > 0 ? (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-stone-700 dark:text-stone-300">Pay out by</Label>
                  <Select value={method} onChange={(e) => setMethod(e.target.value as Method)}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="split">Split (Cash + UPI)</option>
                  </Select>
                </div>
                {method === "split" && (
                  <div>
                    <Label className="text-stone-700 dark:text-stone-300">Paid by cash ({currency}) — rest UPI</Label>
                    <Input
                      type="number"
                      min="0"
                      max={outstanding}
                      step="0.01"
                      value={cashPortion}
                      onChange={(e) => setCashPortion(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                )}
              </div>
              {method === "split" && (
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Cash {formatCurrency(cashPaid, currency)} · UPI {formatCurrency(upiPaid, currency)} of{" "}
                  {formatCurrency(outstanding, currency)}
                </p>
              )}
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
              <Button disabled={busy} onClick={settle} className="w-full sm:w-auto">
                Settle up · {formatCurrency(outstanding, currency)}
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-stone-500">Nothing outstanding — all share is settled.</p>
          )}
        </div>

        {history.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Settlement history ({history.length})
            </p>
            <div className="space-y-2">
              {pag.pageItems.map((h) => (
                <div key={h.id} className="rounded-lg border border-black/10 px-3 py-2.5 dark:border-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-stone-900 dark:text-white">
                      {formatCurrency(Number(h.amount), currency)} settled
                    </span>
                    <MethodBadge method={h.method} />
                  </div>
                  <div className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-stone-500 sm:grid-cols-2">
                    <span>{formatDateTime(h.created_at)}</span>
                    <span>10% of {formatCurrency(Number(h.profit_base), currency)} profit</span>
                    {h.method === "split" && (
                      <span>
                        Cash {formatCurrency(Number(h.paid_cash), currency)} · UPI{" "}
                        {formatCurrency(Number(h.paid_upi), currency)}
                      </span>
                    )}
                    {h.note && <span className="text-stone-600 dark:text-stone-300">“{h.note}”</span>}
                  </div>
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
