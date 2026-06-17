"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeftRight, Plus, Trash2, X, ArrowRight } from "lucide-react";
import { AdminCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatCurrency, formatDate, istDateString } from "@/lib/utils/formatters";
import { INCOME_METHODS, INCOME_METHOD_LABEL } from "@/lib/utils/income";
import { createMethodTransferAction, deleteMethodTransferAction } from "@/app/admin/reports/actions";
import type { IncomeMethod, MethodTransfer } from "@/lib/types";

type SourceRow = { method: IncomeMethod; amount: string };

export function MethodTransfers({
  transfers,
  currency,
}: {
  transfers: MethodTransfer[];
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(istDateString());
  const [note, setNote] = useState("");
  const [sources, setSources] = useState<SourceRow[]>([{ method: "bank", amount: "" }]);
  const [dest, setDest] = useState<IncomeMethod>("cash");
  const [deleteTarget, setDeleteTarget] = useState<MethodTransfer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const total = sources.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  function reset() {
    setDate(istDateString());
    setNote("");
    setSources([{ method: "bank", amount: "" }]);
    setDest("cash");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (total <= 0) return toast.error("Enter a source amount greater than 0.");

    const legs: { method: IncomeMethod; delta: number }[] = [];
    for (const r of sources) {
      const amt = Number(r.amount) || 0;
      if (amt > 0) legs.push({ method: r.method, delta: -amt });
    }
    legs.push({ method: dest, delta: Number(total.toFixed(2)) });

    setBusy(true);
    const res = await createMethodTransferAction({ date, note, legs });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Transfer recorded.");
    setOpen(false);
    reset();
    router.refresh();
  }

  async function removeConfirmed() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await deleteMethodTransferAction(deleteTarget.id);
    setDeleting(false);
    if (!res.ok) return toast.error(res.error);
    setDeleteTarget(null);
    toast.success("Transfer removed.");
    router.refresh();
  }

  return (
    <>
      <AdminCard
        title="Income Transfers"
        action={
          <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="border-[#333] text-gray-300">
            <ArrowLeftRight className="h-4 w-4" /> Transfer
          </Button>
        }
      >
        {transfers.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            No transfers. Move income between methods to correct the breakdown.
          </p>
        ) : (
          <div className="space-y-2">
            {transfers.map((t) => {
              const srcs = (t.legs ?? []).filter((l) => Number(l.delta) < 0);
              const dests = (t.legs ?? []).filter((l) => Number(l.delta) > 0);
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#222] px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-gray-300">
                    {srcs.map((l, i) => (
                      <span key={l.id}>
                        {i > 0 && <span className="text-gray-600"> + </span>}
                        {INCOME_METHOD_LABEL[l.method]} {formatCurrency(Math.abs(Number(l.delta)), currency)}
                      </span>
                    ))}
                    <ArrowRight className="h-3.5 w-3.5 text-gray-500" />
                    {dests.map((l, i) => (
                      <span key={l.id} className="font-medium text-white">
                        {i > 0 && <span className="text-gray-600"> + </span>}
                        {INCOME_METHOD_LABEL[l.method]} {formatCurrency(Number(l.delta), currency)}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className="text-xs text-gray-500">{formatDate(t.date)}</span>
                    {t.note && <span className="text-xs text-gray-500">“{t.note}”</span>}
                    <button
                      onClick={() => setDeleteTarget(t)}
                      className="rounded-md p-1.5 text-gray-500 hover:bg-red-500/15 hover:text-red-500"
                      aria-label="Delete transfer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AdminCard>

      <Modal open={open} onClose={() => setOpen(false)} title="Transfer income between methods">
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label htmlFor="mt-date">Date</Label>
            <Input id="mt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>From</Label>
            {sources.map((row, i) => (
              <div key={i} className="flex gap-2">
                <Select
                  value={row.method}
                  onChange={(e) =>
                    setSources((s) => s.map((r, j) => (j === i ? { ...r, method: e.target.value as IncomeMethod } : r)))
                  }
                >
                  {INCOME_METHODS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.amount}
                  placeholder="0"
                  onChange={(e) =>
                    setSources((s) => s.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)))
                  }
                  className="w-32"
                />
                {sources.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSources((s) => s.filter((_, j) => j !== i))}
                    className="rounded-md p-2 text-stone-500 hover:bg-red-500/15 hover:text-red-500"
                    aria-label="Remove source"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSources((s) => [...s, { method: "other", amount: "" }])}
              className="inline-flex items-center gap-1 text-xs font-medium text-yellow-500 hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Add source
            </button>
          </div>

          <div>
            <Label htmlFor="mt-dest">To</Label>
            <Select id="mt-dest" value={dest} onChange={(e) => setDest(e.target.value as IncomeMethod)}>
              {INCOME_METHODS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-stone-500">
              {INCOME_METHOD_LABEL[dest]} receives <b>{formatCurrency(total, currency)}</b>.
            </p>
          </div>

          <div>
            <Label htmlFor="mt-note">Note (optional)</Label>
            <Input id="mt-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Transfer
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete transfer"
        description="Remove this transfer? The income breakdown reverts to before it."
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeConfirmed}
      />
    </>
  );
}
