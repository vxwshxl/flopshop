"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Pencil, Trash2, Plus, Banknote, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { TableToolbar, SortHeader } from "@/components/admin/TableControls";
import { useTableControls, byText, byNum, byDate } from "@/lib/hooks/useTableControls";
import { formatCurrency, formatDate, istDateString } from "@/lib/utils/formatters";
import {
  addWithdrawalAction,
  updateWithdrawalAction,
  deleteWithdrawalAction,
} from "@/app/admin/withdrawals/actions";
import type { Withdrawal } from "@/lib/types";

type Method = "cash" | "upi";
type Draft = { date: string; amount: string; method: Method; purpose: string; note: string };

const emptyDraft = (): Draft => ({
  date: istDateString(),
  amount: "",
  method: "upi",
  purpose: "",
  note: "",
});

function MethodBadge({ method }: { method: Method }) {
  return method === "cash" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-500">
      <Banknote className="h-3 w-3" /> Cash
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-500">
      <Smartphone className="h-3 w-3" /> UPI
    </span>
  );
}

export function WithdrawalsManager({
  withdrawals,
  currency,
}: {
  withdrawals: Withdrawal[];
  currency: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(withdrawals);
  const [editing, setEditing] = useState<Withdrawal | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Withdrawal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const ctl = useTableControls(rows, {
    searchFields: (w) => [w.purpose, w.note],
    dateField: (w) => w.date,
    sorters: {
      date: byDate((w) => w.date),
      amount: byNum((w) => w.amount),
      purpose: byText((w) => w.purpose ?? ""),
    },
    initialSort: "date",
    initialDir: "desc",
  });
  const pag = usePagination(ctl.rows);

  function openAdd() {
    setEditing(null);
    setDraft(emptyDraft());
    setOpen(true);
  }

  function openEdit(w: Withdrawal) {
    setEditing(w);
    setDraft({
      date: w.date,
      amount: String(w.amount),
      method: w.method,
      purpose: w.purpose ?? "",
      note: w.note ?? "",
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = editing
      ? await updateWithdrawalAction({ id: editing.id, ...draft })
      : await addWithdrawalAction(draft);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);

    setRows((prev) =>
      editing ? prev.map((r) => (r.id === editing.id ? res.withdrawal : r)) : [res.withdrawal, ...prev]
    );
    toast.success(editing ? "Withdrawal updated." : "Withdrawal added.");
    setOpen(false);
    setEditing(null);
    router.refresh();
  }

  async function removeConfirmed() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await deleteWithdrawalAction(deleteTarget.id);
    setDeleting(false);
    if (!res.ok) return toast.error(res.error);
    setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Withdrawal deleted.");
    router.refresh();
  }

  return (
    <div className="glass mt-4 rounded-2xl">
      <div className="glass-line flex items-center justify-between gap-2 border-b px-4 py-3">
        <h3 className="text-sm font-bold text-stone-900 dark:text-white">Withdrawal ledger</h3>
        <Button onClick={openAdd} className="!px-3 !py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add withdrawal
        </Button>
      </div>

      <div className="p-4">
        <TableToolbar
          query={ctl.query}
          onQuery={ctl.setQuery}
          placeholder="Search purpose / note…"
          from={ctl.from}
          to={ctl.to}
          onFrom={ctl.setFrom}
          onTo={ctl.setTo}
          hasDateFilter={ctl.hasDateFilter}
          onClearDates={ctl.clearDates}
        />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs text-black/50 dark:border-white/10 dark:text-white/50">
                <SortHeader label="Date" sortKey="date" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} defaultDir="desc" />
                <SortHeader label="Amount" sortKey="amount" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} className="text-right" defaultDir="desc" />
                <th className="p-3">Method</th>
                <SortHeader label="Purpose" sortKey="purpose" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} />
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-black/75 dark:text-white/75">
              {pag.pageItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-xs text-stone-500">
                    No withdrawals recorded.
                  </td>
                </tr>
              ) : (
                pag.pageItems.map((w) => (
                  <tr key={w.id} className="border-b border-black/10 last:border-0 dark:border-white/10">
                    <td className="whitespace-nowrap p-3">{formatDate(w.date)}</td>
                    <td className="whitespace-nowrap p-3 text-right font-semibold text-stone-900 dark:text-white">
                      {formatCurrency(Number(w.amount), currency)}
                    </td>
                    <td className="p-3">
                      <MethodBadge method={w.method} />
                    </td>
                    <td className="p-3">
                      {w.purpose || <span className="text-stone-400">—</span>}
                      {w.note && <span className="block text-xs text-stone-500">{w.note}</span>}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(w)}
                          className="rounded-md p-1.5 text-black/50 hover:bg-yellow-400 hover:text-black dark:text-white/50"
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(w)}
                          className="rounded-md p-1.5 text-black/50 hover:bg-red-500/15 hover:text-red-500 dark:text-white/50"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={editing ? "Edit withdrawal" : "Add withdrawal"}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="w-date">Date</Label>
              <Input id="w-date" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="w-amount">Amount ({currency})</Label>
              <Input id="w-amount" type="number" min="0" step="0.01" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} placeholder="0" autoFocus />
            </div>
          </div>
          <div>
            <Label htmlFor="w-method">Method</Label>
            <Select value={draft.method} onChange={(e) => setDraft({ ...draft, method: e.target.value as Method })}>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="w-purpose">Purpose</Label>
            <Input id="w-purpose" value={draft.purpose} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })} placeholder="e.g. Blinkit, BigBasket, withdrawal" />
          </div>
          <div>
            <Label htmlFor="w-note">Note (optional)</Label>
            <Input id="w-note" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {editing ? "Save" : "Add"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete withdrawal"
        description={
          deleteTarget
            ? `Delete this ${formatCurrency(Number(deleteTarget.amount), currency)} withdrawal? This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeConfirmed}
      />
    </div>
  );
}
