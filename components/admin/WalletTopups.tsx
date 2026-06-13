"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import { approveTopupAction, rejectTopupAction } from "@/app/admin/wallet/actions";

export type TopupRow = {
  id: string;
  amount: number;
  method: "cash" | "upi";
  reference: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  name: string;
  email: string | null;
};

export function WalletTopups({
  pending,
  history,
  currency,
}: {
  pending: TopupRow[];
  history: TopupRow[];
  currency: string;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  function approve(id: string) {
    startTransition(async () => {
      const res = await approveTopupAction(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Top-up approved — credit added.");
      router.refresh();
    });
  }
  function reject(id: string) {
    startTransition(async () => {
      const res = await rejectTopupAction(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Request rejected.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl">
        <div className="glass-line border-b px-4 py-3">
          <h3 className="text-sm font-bold text-stone-900 dark:text-white">Pending top-up requests</h3>
        </div>
        <div className="space-y-3 p-4">
          {pending.length === 0 ? (
            <p className="text-sm text-stone-500">No requests awaiting verification.</p>
          ) : (
            pending.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10">
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900 dark:text-white">{r.name}</p>
                  <p className="text-xs text-stone-500">
                    {formatDateTime(r.created_at)} · via {r.method.toUpperCase()}
                    {r.reference ? ` · ref ${r.reference}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-extrabold text-stone-900 dark:text-white">
                    {formatCurrency(Number(r.amount), currency)}
                  </span>
                  <Button size="sm" disabled={busy} onClick={() => approve(r.id)}>
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => reject(r.id)}>
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="glass rounded-2xl">
          <div className="glass-line border-b px-4 py-3">
            <h3 className="text-sm font-bold text-stone-900 dark:text-white">Recently reviewed</h3>
          </div>
          <div className="space-y-2 p-4">
            {history.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10">
                <div>
                  <p className="font-medium text-stone-900 dark:text-white">{r.name}</p>
                  <p className="text-xs text-stone-500">{formatDateTime(r.created_at)} · {r.method.toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-stone-900 dark:text-white">{formatCurrency(Number(r.amount), currency)}</p>
                  <p className={`text-xs ${r.status === "approved" ? "text-lime-500" : "text-red-500"}`}>{r.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
