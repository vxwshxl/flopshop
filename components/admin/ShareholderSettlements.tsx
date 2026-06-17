"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Users, Trash2, CheckCircle2, Clock, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/formatters";
import { settleShareholderAction, deleteSettlementAction } from "@/app/admin/shareholders/actions";

export type SettlementRow = {
  id: string;
  amount: number;
  profit_base: number;
  settled_through: string;
  status: "pending" | "confirmed";
  confirmed_at: string | null;
  note: string | null;
  created_at: string;
};

export type HolderView = {
  id: string;
  name: string;
  type: string | null;
  share_percent: number;
  profit_from: string | null;
  is_active: boolean;
  linkedLabel: string | null;
  outstandingBase: number;
  outstandingAmount: number;
  history: SettlementRow[];
};

function StatusBadge({ status }: { status: "pending" | "confirmed" }) {
  return status === "confirmed" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
      <CheckCircle2 className="h-3 w-3" /> Confirmed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-500">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
}

function HolderCard({ holder, currency }: { holder: HolderView; currency: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, startTransition] = useTransition();
  const [reverseTarget, setReverseTarget] = useState<SettlementRow | null>(null);
  const [reversing, setReversing] = useState(false);

  function settle() {
    startTransition(async () => {
      const res = await settleShareholderAction(holder.id, note);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Settled ${formatCurrency(res.amount, currency)} to ${res.name}.`);
      setNote("");
      router.refresh();
    });
  }

  async function reverseConfirmed() {
    if (!reverseTarget) return;
    setReversing(true);
    const res = await deleteSettlementAction(reverseTarget.id);
    setReversing(false);
    if (!res.ok) return toast.error(res.error);
    setReverseTarget(null);
    toast.success("Settlement reversed.");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-900 dark:text-white">{holder.name}</span>
            <span className="text-xs text-stone-500">{holder.share_percent}%</span>
            {!holder.is_active && (
              <span className="rounded-full border border-black/15 px-2 py-0.5 text-[10px] text-stone-500 dark:border-white/15">
                Inactive
              </span>
            )}
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
            {holder.type && <span className="capitalize">{holder.type}</span>}
            {holder.type && holder.linkedLabel && " · "}
            {holder.linkedLabel ? (
              <span className="inline-flex items-center gap-1">
                <UserCheck className="h-3 w-3" /> {holder.linkedLabel}
              </span>
            ) : (
              <span className="text-amber-500">no account linked</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-extrabold text-stone-900 dark:text-white">
            {formatCurrency(holder.outstandingAmount, currency)}
          </p>
          <p className="text-[11px] text-stone-500">
            {holder.share_percent}% of {formatCurrency(holder.outstandingBase, currency)}
            {holder.profit_from ? ` · from ${formatDate(holder.profit_from)}` : ""}
          </p>
        </div>
      </div>

      {holder.outstandingAmount > 0 && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="sm:flex-1"
          />
          <Button disabled={busy} onClick={settle} className="shrink-0">
            Settle · {formatCurrency(holder.outstandingAmount, currency)}
          </Button>
        </div>
      )}

      {holder.history.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-black/10 pt-3 dark:border-white/10">
          {holder.history.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-stone-900 dark:text-white">
                  {formatCurrency(h.amount, currency)}
                </span>
                <StatusBadge status={h.status} />
                <span className="text-stone-500">{formatDateTime(h.created_at)}</span>
                {h.note && <span className="text-stone-500">“{h.note}”</span>}
              </div>
              <button
                onClick={() => setReverseTarget(h)}
                className="rounded-md p-1.5 text-black/40 hover:bg-red-500/15 hover:text-red-500 disabled:opacity-50 dark:text-white/40"
                aria-label="Reverse settlement"
                title="Reverse settlement"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!reverseTarget}
        title="Reverse settlement"
        description={
          reverseTarget
            ? `Reverse this ${formatCurrency(reverseTarget.amount, currency)} settlement? The profit returns to ${holder.name}'s balance.`
            : ""
        }
        confirmLabel="Reverse"
        loading={reversing}
        onCancel={() => setReverseTarget(null)}
        onConfirm={reverseConfirmed}
      />
    </div>
  );
}

export function ShareholderSettlements({
  holders,
  currency,
}: {
  holders: HolderView[];
  currency: string;
}) {
  const active = holders.filter((h) => h.is_active || h.history.length > 0);

  return (
    <div className="glass mt-4 rounded-2xl">
      <div className="glass-line flex items-center gap-2 border-b px-4 py-3">
        <Users className="h-4 w-4 text-yellow-400" />
        <h3 className="text-sm font-bold text-stone-900 dark:text-white">Settle profit per shareholder</h3>
      </div>
      <div className="space-y-3 p-4">
        {active.length === 0 ? (
          <p className="text-xs text-stone-500">No shareholders yet — add one in the roster below.</p>
        ) : (
          active.map((h) => <HolderCard key={h.id} holder={h} currency={currency} />)
        )}
      </div>
    </div>
  );
}
