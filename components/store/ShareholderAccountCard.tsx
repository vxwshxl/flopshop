"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { TrendingUp, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import { confirmSettlementAction } from "@/app/admin/shareholders/actions";

export type MySettlement = {
  id: string;
  amount: number;
  settled_through: string;
  status: "pending" | "confirmed";
  confirmed_at: string | null;
  note: string | null;
  created_at: string;
};

export function ShareholderAccountCard({
  name,
  sharePercent,
  settlements,
  currency,
}: {
  name: string;
  sharePercent: number;
  settlements: MySettlement[];
  currency: string;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<string | null>(null);

  const pendingTotal = settlements
    .filter((s) => s.status === "pending")
    .reduce((sum, s) => sum + Number(s.amount), 0);

  function confirm(id: string) {
    setConfirming(id);
    startTransition(async () => {
      const res = await confirmSettlementAction(id);
      setConfirming(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Settlement confirmed as received.");
      router.refresh();
    });
  }

  return (
    <div className="glass mt-4 rounded-2xl">
      <div className="glass-line flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-yellow-400" />
          <h3 className="text-sm font-bold text-stone-900 dark:text-white">
            Your shareholder payouts
          </h3>
        </div>
        <span className="text-xs text-stone-500">
          {name} · {sharePercent}%
        </span>
      </div>

      <div className="space-y-3 p-4">
        {pendingTotal > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {formatCurrency(pendingTotal, currency)}
            </span>{" "}
            <span className="text-stone-600 dark:text-stone-300">
              awaiting your confirmation.
            </span>
          </div>
        )}

        {settlements.length === 0 ? (
          <p className="text-xs text-stone-500">No settlements yet.</p>
        ) : (
          <div className="space-y-2">
            {settlements.map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-black/10 px-3 py-2.5 dark:border-white/10"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-stone-900 dark:text-white">
                    {formatCurrency(Number(s.amount), currency)}
                  </span>
                  {s.status === "confirmed" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
                      <CheckCircle2 className="h-3 w-3" /> Confirmed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-500">
                      <Clock className="h-3 w-3" /> Pending
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-stone-500">
                  Settled {formatDateTime(s.created_at)}
                  {s.confirmed_at ? ` · confirmed ${formatDateTime(s.confirmed_at)}` : ""}
                </p>
                {s.note && (
                  <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-300">“{s.note}”</p>
                )}
                {s.status === "pending" && (
                  <Button
                    onClick={() => confirm(s.id)}
                    disabled={busy && confirming === s.id}
                    className="mt-2 !px-3 !py-1.5 text-xs"
                  >
                    Confirm received
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
