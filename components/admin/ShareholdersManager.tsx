"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Pencil, Trash2, Plus, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  addShareholderAction,
  updateShareholderAction,
  deleteShareholderAction,
} from "@/app/admin/shareholders/actions";
import { totalPercent } from "@/lib/utils/shareholders";
import { formatDate } from "@/lib/utils/formatters";
import type { Shareholder } from "@/lib/types";

export type LinkUser = { id: string; email: string | null; full_name: string | null };

type Draft = {
  name: string;
  type: string;
  share_percent: string;
  profit_from: string;
  profile_id: string;
  is_active: boolean;
};

const EMPTY: Draft = {
  name: "",
  type: "",
  share_percent: "",
  profit_from: "",
  profile_id: "",
  is_active: true,
};

export function ShareholdersManager({
  shareholders: initial,
  users,
}: {
  shareholders: Shareholder[];
  users: LinkUser[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<Shareholder | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Shareholder | null>(null);
  const [deleting, setDeleting] = useState(false);

  const activeTotal = totalPercent(rows.filter((r) => r.is_active));
  const balanced = Math.abs(activeTotal - 100) <= 0.01;

  const userLabel = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u ? u.full_name || u.email || "Linked account" : "Linked account";
  };

  function openAdd() {
    setEditing(null);
    setDraft(EMPTY);
    setOpen(true);
  }

  function openEdit(s: Shareholder) {
    setEditing(s);
    setDraft({
      name: s.name,
      type: s.type ?? "",
      share_percent: String(s.share_percent),
      profit_from: s.profit_from ?? "",
      profile_id: s.profile_id ?? "",
      is_active: s.is_active,
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = editing
      ? await updateShareholderAction({ id: editing.id, ...draft })
      : await addShareholderAction(draft);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);

    setRows((prev) =>
      editing ? prev.map((r) => (r.id === editing.id ? res.shareholder : r)) : [...prev, res.shareholder]
    );
    toast.success(editing ? "Shareholder updated." : "Shareholder added.");
    setOpen(false);
    setEditing(null);
    router.refresh();
  }

  async function removeConfirmed() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await deleteShareholderAction(deleteTarget.id);
    setDeleting(false);
    if (!res.ok) return toast.error(res.error);
    setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Shareholder removed.");
    router.refresh();
  }

  return (
    <div className="glass mt-4 rounded-2xl">
      <div className="glass-line flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <UserCog className="h-4 w-4 text-yellow-400" />
          <h3 className="text-sm font-bold text-stone-900 dark:text-white">Shareholder roster</h3>
        </div>
        <Button onClick={openAdd} className="!px-3 !py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      <div className="space-y-2 p-4">
        {rows.length === 0 && (
          <p className="text-xs text-stone-500">No shareholders yet — add one to start distributing profit.</p>
        )}

        {rows.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3 rounded-lg border border-black/10 px-3 py-2.5 dark:border-white/10"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-stone-900 dark:text-white">{s.name}</span>
                {!s.is_active && (
                  <span className="rounded-full border border-black/15 px-2 py-0.5 text-[10px] text-stone-500 dark:border-white/15">
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500">
                {s.type && <span className="capitalize">{s.type}</span>}
                {s.type && s.profit_from && " · "}
                {s.profit_from && <span>from {formatDate(s.profit_from)}</span>}
                {(s.type || s.profit_from) && " · "}
                {s.profile_id ? (
                  <span>{userLabel(s.profile_id)}</span>
                ) : (
                  <span className="text-amber-500">no account</span>
                )}
              </p>
            </div>
            <span className="text-sm font-bold text-stone-900 dark:text-white">{Number(s.share_percent)}%</span>
            <div className="flex gap-1">
              <button
                onClick={() => openEdit(s)}
                className="rounded-md p-1.5 text-black/50 hover:bg-yellow-400 hover:text-black dark:text-white/50"
                aria-label="Edit"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDeleteTarget(s)}
                className="rounded-md p-1.5 text-black/50 hover:bg-yellow-400 hover:text-black dark:text-white/50"
                aria-label="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {rows.length > 0 && (
          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-stone-500">Active shares total</span>
            <span className={`font-bold ${balanced ? "text-emerald-500" : "text-amber-500"}`}>
              {activeTotal}%{balanced ? "" : " — must equal 100% to settle"}
            </span>
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        title={editing ? "Edit shareholder" : "Add shareholder"}
      >
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label htmlFor="sh-name">Name</Label>
            <Input
              id="sh-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Philip"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="sh-type">Type</Label>
            <Input
              id="sh-type"
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value })}
              placeholder="e.g. founder, investor, developer"
            />
          </div>
          <div>
            <Label htmlFor="sh-pct">Share %</Label>
            <Input
              id="sh-pct"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={draft.share_percent}
              onChange={(e) => setDraft({ ...draft, share_percent: e.target.value })}
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor="sh-from">Count profit from</Label>
            <Input
              id="sh-from"
              type="date"
              value={draft.profit_from}
              onChange={(e) => setDraft({ ...draft, profit_from: e.target.value })}
            />
            <p className="mt-1 text-xs text-stone-500">
              Optional — leave blank to earn on all-time profit (e.g. founders).
            </p>
          </div>
          <div>
            <Label htmlFor="sh-account">Linked account</Label>
            <Select
              value={draft.profile_id}
              onChange={(e) => setDraft({ ...draft, profile_id: e.target.value })}
            >
              <option value="">— No account —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email || u.id}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-stone-500">
              The user who can view & confirm this shareholder&apos;s settlements from their account.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
              className="h-4 w-4 accent-yellow-400"
            />
            Active (included in the split)
          </label>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
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
        title="Remove shareholder"
        description={`Remove ${deleteTarget?.name ?? "this shareholder"} from the roster?`}
        confirmLabel="Remove"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeConfirmed}
      />
    </div>
  );
}
