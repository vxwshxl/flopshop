"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import toast from "react-hot-toast";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { DatePicker } from "@/components/ui/date-picker";
import { TableScroll, tableCardClass } from "@/components/admin/TableShell";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { deletePurchaseAction, updatePurchaseAction } from "@/app/admin/purchases/actions";
import type { Purchase } from "@/lib/types";

type SortKey = "purchase_date" | "product_name" | "total_cost";
type SortDir = "asc" | "desc";

const inputDark = "border-[#333] bg-[#0a0a0a] text-white";

export function PurchasesTable({ purchases, currency }: { purchases: Purchase[]; currency: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("purchase_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [deleting, setDeleting] = useState<Purchase | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = purchases.filter((p) => {
      const matchQ =
        !q ||
        p.product_name.toLowerCase().includes(q) ||
        (p.supplier ?? "").toLowerCase().includes(q);
      const day = (p.purchase_date ?? "").slice(0, 10);
      const matchFrom = !from || day >= from;
      const matchTo = !to || day <= to;
      return matchQ && matchFrom && matchTo;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sortKey === "product_name") {
        av = a.product_name.toLowerCase();
        bv = b.product_name.toLowerCase();
      } else if (sortKey === "total_cost") {
        av = Number(a.total_cost);
        bv = Number(b.total_cost);
      } else {
        av = `${a.purchase_date ?? ""} ${a.created_at ?? ""}`;
        bv = `${b.purchase_date ?? ""} ${b.created_at ?? ""}`;
      }
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [purchases, query, from, to, sortKey, sortDir]);

  const { page, setPage, perPage, setPerPage, total, totalPages, pageItems } = usePagination(filtered);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "product_name" ? "asc" : "desc");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const res = await deletePurchaseAction(deleting.id);
    setBusy(false);
    if (!res.ok) return toast.error(res.error ?? "Failed to delete.");
    toast.success("Purchase deleted");
    setDeleting(null);
    router.refresh();
  }

  const sortTh = (k: SortKey, label: string) => (
    <th className="p-3">
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-white">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortKey === k ? "text-lime-400" : "opacity-40"}`} />
      </button>
    </th>
  );

  return (
    <div className={tableCardClass}>
      <div className="mb-3 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search product or supplier…"
            className={`h-10 w-full rounded-lg border pl-9 pr-3 text-sm ${inputDark}`}
          />
        </div>
        <div className="flex items-center gap-2">
          <DatePicker value={from} onChange={setFrom} className="w-36" />
          <span className="text-white/40">→</span>
          <DatePicker value={to} onChange={setTo} className="w-36" />
          {(from || to) && (
            <Button size="sm" variant="outline" onClick={() => { setFrom(""); setTo(""); }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <TableScroll className="rounded-xl border-[#222] bg-[#1a1a1a]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 [&_th]:bg-[#1a1a1a]">
            <tr className="border-b border-[#222] text-left text-xs text-gray-500">
              {sortTh("purchase_date", "Date")}
              {sortTh("product_name", "Product")}
              <th className="p-3">Qty</th>
              <th className="p-3">Unit Price</th>
              {sortTh("total_cost", "Total")}
              <th className="p-3">Supplier</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">No purchases found.</td>
              </tr>
            )}
            {pageItems.map((p) => (
              <tr key={p.id} className="border-b border-[#222] last:border-0 hover:bg-white/5">
                <td className="p-3 whitespace-nowrap">{formatDate(p.purchase_date)}</td>
                <td className="p-3 font-medium text-white">{p.product_name}</td>
                <td className="p-3">{p.quantity}</td>
                <td className="p-3">{formatCurrency(p.unit_price, currency)}</td>
                <td className="p-3">{formatCurrency(p.total_cost, currency)}</td>
                <td className="p-3">{p.supplier ?? "—"}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setEditing(p)} className="rounded p-1.5 text-gray-400 hover:bg-white/10 hover:text-white" aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleting(p)} className="rounded p-1.5 text-gray-400 hover:bg-red-500/15 hover:text-red-400" aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <div className="shrink-0">
        <Pagination page={page} totalPages={totalPages} perPage={perPage} total={total} onPage={setPage} onPerPage={setPerPage} />
      </div>

      {editing && (
        <EditPurchaseModal
          purchase={editing}
          currency={currency}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      )}

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete purchase">
        <p className="mb-5 text-sm text-stone-400">
          Delete this purchase of <span className="font-semibold text-white">{deleting?.product_name}</span>? The{" "}
          {deleting?.quantity} unit(s) it added will be removed from stock.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="outline" className="w-full" onClick={() => setDeleting(null)} disabled={busy}>Cancel</Button>
          <Button className="w-full bg-red-500 text-white hover:bg-red-600" onClick={confirmDelete} disabled={busy}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}

function EditPurchaseModal({
  purchase,
  currency,
  onClose,
  onSaved,
}: {
  purchase: Purchase;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    quantity: String(purchase.quantity),
    unit_price: String(purchase.unit_price),
    supplier: purchase.supplier ?? "",
    purchase_date: (purchase.purchase_date ?? "").slice(0, 10),
    notes: purchase.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const total = (Number(form.quantity) || 0) * (Number(form.unit_price) || 0);

  async function save() {
    setSaving(true);
    const res = await updatePurchaseAction(purchase.id, {
      quantity: Number(form.quantity) || 1,
      unit_price: Number(form.unit_price) || 0,
      supplier: form.supplier,
      purchase_date: form.purchase_date,
      notes: form.notes,
    });
    setSaving(false);
    if (!res.ok) return toast.error(res.error ?? "Failed to save.");
    toast.success("Purchase updated");
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title={`Edit purchase · ${purchase.product_name}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-gray-300">Quantity</Label>
            <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} className={inputDark} />
          </div>
          <div>
            <Label className="text-gray-300">Unit cost ({currency})</Label>
            <Input type="number" min="0" step="0.01" value={form.unit_price} onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))} className={inputDark} />
          </div>
        </div>
        <div>
          <Label className="text-gray-300">Purchase date</Label>
          <DatePicker value={form.purchase_date} onChange={(v) => setForm((f) => ({ ...f, purchase_date: v }))} />
        </div>
        <div>
          <Label className="text-gray-300">Supplier</Label>
          <Input value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} className={inputDark} />
        </div>
        <p className="text-sm text-gray-400">Total: <span className="font-semibold text-white">{formatCurrency(total, currency)}</span></p>
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <Button variant="outline" className="w-full" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="w-full" onClick={save} disabled={saving}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
