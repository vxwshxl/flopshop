"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Merge, Wallet as WalletIcon } from "lucide-react";
import toast from "react-hot-toast";
import {
  createCustomerAction,
  updateCustomerAction,
  deleteCustomerAction,
  mergeCustomersAction,
} from "@/app/admin/customers/actions";
import { PageHeader } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { TableToolbar, SortHeader } from "@/components/admin/TableControls";
import { TableScroll, tablePageClass, tableCardClass, stickyHead } from "@/components/admin/TableShell";
import { WalletPanel } from "@/components/admin/WalletPanel";
import { useTableControls, byText, byDate } from "@/lib/hooks/useTableControls";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { formatCurrency } from "@/lib/utils/formatters";
import type { Customer, Hostel } from "@/lib/types";

const empty = { name: "", phone: "", email: "", room_number: "", hostel_block: "" };

export function CustomersManager({
  customers: initial,
  hostels,
  balances = {},
}: {
  customers: Customer[];
  hostels: Hostel[];
  balances?: Record<string, number>;
}) {
  const [customers, setCustomers] = useState(initial);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);
  // Customer whose store-credit wallet is open for adjustment.
  const [creditCustomer, setCreditCustomer] = useState<Customer | null>(null);
  // Multi-select for merging duplicates (case variants / typos).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showMerge, setShowMerge] = useState(false);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const router = useRouter();
  // Store-credit filter: all / credit (balance > 0) / debt (< 0) / settled (= 0).
  const [balanceFilter, setBalanceFilter] = usePersistentState<"all" | "credit" | "debt" | "settled">(
    "admin:customers:balance",
    "all"
  );
  const byBalance =
    balanceFilter === "all"
      ? customers
      : customers.filter((c) => {
          const bal = balances[c.id] ?? 0;
          if (balanceFilter === "credit") return bal > 0;
          if (balanceFilter === "debt") return bal < 0;
          return bal === 0; // settled
        });
  const ctl = useTableControls(byBalance, {
    searchFields: (c) => [c.name, c.phone, c.room_number, c.hostel_block],
    dateField: (c) => c.created_at,
    sorters: {
      name: byText((c) => c.name),
      room: byText((c) => c.room_number),
      created: byDate((c) => c.created_at),
    },
    initialSort: "name",
    initialDir: "asc",
    persistKey: "admin:customers:ctl",
  });
  const { page, setPage, perPage, setPerPage, total, totalPages, pageItems } = usePagination(
    ctl.rows,
    20,
    "admin:customers:pg"
  );

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function openAdd() {
    setEditing(null);
    setForm(empty);
    setShowModal(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone,
      email: c.email ?? "",
      room_number: c.room_number ?? "",
      hostel_block: c.hostel_block ?? "",
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      return toast.error("Name and phone are required.");
    }
    setSaving(true);
    const res = editing
      ? await updateCustomerAction(editing.id, form)
      : await createCustomerAction(form);
    setSaving(false);
    if (!res.ok || !res.customer) return toast.error(res.error ?? "Failed to save customer.");

    if (editing) {
      setCustomers((list) => list.map((c) => (c.id === editing.id ? res.customer! : c)));
      toast.success("Customer updated.");
    } else {
      setCustomers((list) => [...list, res.customer!]);
      toast.success("Customer added.");
    }
    setShowModal(false);
    setEditing(null);
    router.refresh();
  }

  async function handleDelete() {
    const c = confirmDelete;
    if (!c) return;
    setDeleting(c.id);
    const res = await deleteCustomerAction(c.id);
    setDeleting(null);
    if (!res.ok) return toast.error(res.error ?? "Failed to delete customer.");
    setCustomers((list) => list.filter((x) => x.id !== c.id));
    setSelected((s) => {
      const n = new Set(s);
      n.delete(c.id);
      return n;
    });
    setConfirmDelete(null);
    toast.success("Customer deleted.");
    router.refresh();
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const selectedCustomers = customers.filter((c) => selected.has(c.id));

  function openMerge() {
    if (selected.size < 2) return toast.error("Select 2 or more customers to merge.");
    // Default to keeping the first selected (admin can change it in the modal).
    setPrimaryId(selectedCustomers[0]?.id ?? null);
    setShowMerge(true);
  }

  async function handleMerge() {
    if (!primaryId) return toast.error("Pick a customer to keep.");
    const duplicateIds = selectedCustomers.map((c) => c.id).filter((id) => id !== primaryId);
    setMerging(true);
    const res = await mergeCustomersAction(primaryId, duplicateIds);
    setMerging(false);
    if (!res.ok) return toast.error(res.error ?? "Failed to merge customers.");
    setCustomers((list) => list.filter((c) => !duplicateIds.includes(c.id)));
    setSelected(new Set());
    setShowMerge(false);
    setPrimaryId(null);
    toast.success(`Merged ${res.mergedCount} duplicate${res.mergedCount === 1 ? "" : "s"}.`);
    router.refresh();
  }

  return (
    <div className={tablePageClass}>
      <PageHeader
        title="Customers"
        action={
          <div className="flex gap-2">
            {selected.size >= 2 && (
              <Button variant="outline" onClick={openMerge}>
                <Merge className="h-4 w-4" /> Merge ({selected.size})
              </Button>
            )}
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add customer
            </Button>
          </div>
        }
      />

      <div className={tableCardClass}>
        <div className="shrink-0">
          <TableToolbar
            query={ctl.query}
            onQuery={ctl.setQuery}
            placeholder="Search name, phone or room…"
            from={ctl.from}
            to={ctl.to}
            onFrom={ctl.setFrom}
            onTo={ctl.setTo}
            hasDateFilter={ctl.hasDateFilter}
            onClearDates={ctl.clearDates}
          >
            <Select
              value={balanceFilter}
              onChange={(e) => setBalanceFilter(e.target.value as typeof balanceFilter)}
              className="w-40 lg:w-44"
            >
              <option value="all">All balances</option>
              <option value="credit">Has credit</option>
              <option value="debt">Has debt</option>
              <option value="settled">Settled (₹0)</option>
            </Select>
          </TableToolbar>
        </div>
        <TableScroll>
          <table className="w-full text-sm">
            <thead className={stickyHead}>
              <tr className="border-b border-black/10 text-left text-xs text-black/50 dark:border-white/10 dark:text-white/50">
                <th className="w-10 p-3"></th>
                <SortHeader label="Name" sortKey="name" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} />
                <th className="p-3">Phone</th>
                <SortHeader label="Room" sortKey="room" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} />
                <th className="p-3">Hostel</th>
                <th className="p-3 text-right">Credit</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-black/75 dark:text-white/75">
              {ctl.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-black/50 dark:text-white/50">
                    {customers.length === 0 ? "No customers yet." : "No customers match these filters."}
                  </td>
                </tr>
              )}
              {pageItems.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => openEdit(c)}
                  className="cursor-pointer border-b border-black/10 last:border-0 hover:bg-yellow-400/10 dark:border-white/10"
                >
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      className="h-4 w-4 accent-yellow-400"
                      aria-label={`Select ${c.name}`}
                    />
                  </td>
                  <td className="p-3 font-medium text-white">{c.name}</td>
                  <td className="p-3">{c.phone}</td>
                  <td className="p-3 text-black/50 dark:text-white/50">{c.room_number ?? "—"}</td>
                  <td className="p-3 text-black/50 dark:text-white/50">{c.hostel_block ?? "—"}</td>
                  <td className="p-3 text-right font-medium">
                    {balances[c.id] ? (
                      <span className={balances[c.id] < 0 ? "text-amber-600 dark:text-amber-400" : "text-lime-600 dark:text-lime-400"}>
                        {formatCurrency(balances[c.id], "₹")}
                      </span>
                    ) : (
                      <span className="text-black/30 dark:text-white/30">—</span>
                    )}
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setCreditCustomer(c)} className="rounded-md p-1.5 text-black/50 hover:bg-yellow-400 hover:text-black dark:text-white/50" aria-label="Credit">
                        <WalletIcon className="h-4 w-4" />
                      </button>
                      <button onClick={() => openEdit(c)} className="rounded-md p-1.5 text-black/50 hover:bg-yellow-400 hover:text-black dark:text-white/50" aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(c)}
                        disabled={deleting === c.id}
                        className="rounded-md p-1.5 text-black/50 hover:bg-yellow-400 hover:text-black disabled:opacity-50 dark:text-white/50"
                        aria-label="Delete"
                      >
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
      </div>

      <Modal open={showModal} onClose={() => { setShowModal(false); setEditing(null); }} title={editing ? "Edit customer" : "Add customer"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cust-name">Name *</Label>
              <Input id="cust-name" value={form.name} onChange={set("name")} placeholder="e.g. Nilesh" autoFocus />
            </div>
            <div>
              <Label htmlFor="cust-phone">Phone *</Label>
              <Input id="cust-phone" value={form.phone} onChange={set("phone")} inputMode="tel" placeholder="e.g. 9876543210" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cust-room">Room (optional)</Label>
              <Input id="cust-room" value={form.room_number} onChange={set("room_number")} />
            </div>
            <div>
              <Label htmlFor="cust-hostel">Hostel (optional)</Label>
              <Select
                id="cust-hostel"
                value={form.hostel_block}
                onChange={(e) => setForm((f) => ({ ...f, hostel_block: e.target.value }))}
              >
                <option value="">None</option>
                {hostels.map((h) => (
                  <option key={h.id} value={h.name}>
                    {h.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="cust-email">Email (optional)</Label>
            <Input id="cust-email" type="email" value={form.email} onChange={set("email")} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { setShowModal(false); setEditing(null); }}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save" : "Add"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={showMerge} onClose={() => setShowMerge(false)} title="Merge customers">
        <p className="mb-3 text-sm text-black/60 dark:text-white/60">
          Choose the record to <span className="font-semibold text-black dark:text-white">keep</span>. The others
          are deleted, their details fill any blanks on the kept record, and past orders are re-pointed to its name.
        </p>
        <div className="space-y-2">
          {selectedCustomers.map((c) => (
            <label
              key={c.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${
                primaryId === c.id
                  ? "border-yellow-400 bg-yellow-400/10"
                  : "border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
              }`}
            >
              <input
                type="radio"
                name="merge-primary"
                checked={primaryId === c.id}
                onChange={() => setPrimaryId(c.id)}
                className="h-4 w-4 accent-yellow-400"
              />
              <span>
                <span className="block font-medium text-black dark:text-white">{c.name}</span>
                <span className="block text-xs text-black/50 dark:text-white/50">
                  {c.phone || "no phone"}
                  {c.room_number ? ` · Room ${c.room_number}` : ""}
                </span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setShowMerge(false)} disabled={merging}>
            Cancel
          </Button>
          <Button type="button" onClick={handleMerge} loading={merging}>
            Merge into selected
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!creditCustomer}
        onClose={() => setCreditCustomer(null)}
        title={creditCustomer ? `Store credit — ${creditCustomer.name}` : "Store credit"}
      >
        {creditCustomer && (
          <WalletPanel
            owner={{ customerId: creditCustomer.id }}
            initialBalance={balances[creditCustomer.id] ?? 0}
            currency="₹"
          />
        )}
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete customer?">
        <p className="mb-4 text-sm text-black/60 dark:text-white/60">
          Delete <span className="font-semibold text-black dark:text-white">{confirmDelete?.name}</span>? This
          can&apos;t be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmDelete(null)}
            disabled={deleting === confirmDelete?.id}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            loading={deleting === confirmDelete?.id}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
