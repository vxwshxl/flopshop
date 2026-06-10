"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { createSupplierAction, deleteSupplierAction } from "@/app/admin/suppliers/actions";
import { PageHeader } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { TableToolbar, SortHeader } from "@/components/admin/TableControls";
import { TableScroll, tablePageClass, tableCardClass, stickyHead } from "@/components/admin/TableShell";
import { useTableControls, byText, byDate } from "@/lib/hooks/useTableControls";
import { formatDate } from "@/lib/utils/formatters";
import type { Supplier } from "@/lib/types";

export function SuppliersManager({ suppliers: initialSuppliers }: { suppliers: Supplier[] }) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();
  const ctl = useTableControls(suppliers, {
    searchFields: (s) => [s.name],
    dateField: (s) => s.created_at,
    sorters: { name: byText((s) => s.name), created: byDate((s) => s.created_at) },
    initialSort: "name",
    initialDir: "asc",
  });
  const { page, setPage, perPage, setPerPage, total, totalPages, pageItems } = usePagination(ctl.rows);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      return toast.error("Enter a supplier name.");
    }

    setAdding(true);
    const res = await createSupplierAction(newName.trim());
    setAdding(false);

    if (!res.ok) {
      return toast.error(res.error ?? "Failed to add supplier.");
    }

    toast.success("Supplier added.");
    setSuppliers([...suppliers, res.supplier!]);
    setNewName("");
    setShowAddModal(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this supplier?")) return;

    setDeleting(id);
    const res = await deleteSupplierAction(id);
    setDeleting(null);

    if (!res.ok) {
      return toast.error(res.error ?? "Failed to delete supplier.");
    }

    toast.success("Supplier deleted.");
    setSuppliers(suppliers.filter((s) => s.id !== id));
    router.refresh();
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setNewName(s.name);
    setShowAddModal(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setAdding(true);
    const { updateSupplierAction } = await import("@/app/admin/suppliers/actions");
    const res = await updateSupplierAction(editing.id, newName.trim(), editing.is_active);
    setAdding(false);
    if (!res.ok) return toast.error(res.error ?? "Failed to update supplier.");
    toast.success("Supplier updated.");
    setSuppliers(suppliers.map((s) => (s.id === editing.id ? res.supplier! : s)));
    setShowAddModal(false);
    setEditing(null);
    router.refresh();
  }

  return (
    <div className={tablePageClass}>
      <PageHeader
        title="Suppliers"
        action={
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4" /> Add supplier
          </Button>
        }
      />

      <div className={tableCardClass}>
        <div className="shrink-0">
          <TableToolbar
            query={ctl.query}
            onQuery={ctl.setQuery}
            placeholder="Search supplier…"
            from={ctl.from}
            to={ctl.to}
            onFrom={ctl.setFrom}
            onTo={ctl.setTo}
            hasDateFilter={ctl.hasDateFilter}
            onClearDates={ctl.clearDates}
          />
        </div>
        <TableScroll>
          <table className="w-full text-sm">
            <thead className={stickyHead}>
              <tr className="border-b border-black/10 text-left text-xs text-black/50 dark:border-white/10 dark:text-white/50">
                <SortHeader label="Supplier" sortKey="name" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} />
                <SortHeader label="Created" sortKey="created" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} defaultDir="desc" />
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-black/75 dark:text-white/75">
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-black/50 dark:text-white/50">
                    No suppliers yet.
                  </td>
                </tr>
              )}
              {pageItems.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => openEdit(s)}
                  className="cursor-pointer border-b border-black/10 last:border-0 hover:bg-yellow-400/10 dark:border-white/10"
                >
                  <td className="p-3">
                    <span className="font-medium text-white">{s.name}</span>
                  </td>
                  <td className="p-3 text-black/50 dark:text-white/50">{formatDate(s.created_at)}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      s.is_active
                        ? "border border-yellow-400 bg-yellow-400 text-black"
                        : "border border-black/15 text-black/50 dark:border-white/15 dark:text-white/50"
                    }`}>
                      {s.is_active ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={async () => {
                          const { updateSupplierAction } = await import("@/app/admin/suppliers/actions");
                          const res = await updateSupplierAction(s.id, s.name, !s.is_active);
                          if (!res.ok) return toast.error(res.error ?? "Failed to toggle");
                          setSuppliers(suppliers.map((x) => (x.id === s.id ? res.supplier! : x)));
                          toast.success("Updated");
                          router.refresh();
                        }}
                        className="rounded-md p-1.5 text-black/50 hover:bg-yellow-400 hover:text-black dark:text-white/50"
                      >
                        {s.is_active ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        disabled={deleting === s.id}
                        className="rounded-md p-1.5 text-black/50 hover:bg-yellow-400 hover:text-black disabled:opacity-50 dark:text-white/50"
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

      <Modal open={showAddModal} onClose={() => { setShowAddModal(false); setEditing(null); }} title={editing ? "Edit supplier" : "Add supplier"}>
        <form onSubmit={editing ? handleSaveEdit : handleAdd} className="space-y-4">
          <div>
            <Label htmlFor="supplier-name">Supplier name</Label>
            <Input
              id="supplier-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Flipkart"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { setShowAddModal(false); setEditing(null); }}>
              Cancel
            </Button>
            <Button type="submit" loading={adding}>
              {editing ? "Save" : "Add"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
