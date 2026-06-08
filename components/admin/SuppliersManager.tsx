"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { createSupplierAction, deleteSupplierAction } from "@/app/admin/suppliers/actions";
import { PageHeader, AdminCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { Supplier } from "@/lib/types";

export function SuppliersManager({ suppliers: initialSuppliers }: { suppliers: Supplier[] }) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();

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
    <div>
      <PageHeader
        title="Suppliers"
        subtitle="Manage purchase suppliers"
        action={
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4" /> Add supplier
          </Button>
        }
      />

      <AdminCard>
        <div className="overflow-hidden rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-black">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs text-black/50 dark:border-white/10 dark:text-white/50">
                <th className="p-3">Supplier</th>
                <th className="p-3">Created</th>
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
              {suppliers.map((s) => (
                <tr key={s.id} className="border-b border-black/10 last:border-0 hover:bg-yellow-400/10 dark:border-white/10">
                  <td className="p-3">
                    <span className="font-medium text-white">{s.name}</span>
                  </td>
                  <td className="p-3 text-black/50 dark:text-white/50">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      s.is_active
                        ? "border border-yellow-400 bg-yellow-400 text-black"
                        : "border border-black/15 text-black/50 dark:border-white/15 dark:text-white/50"
                    }`}>
                      {s.is_active ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(s)} className="rounded-md p-1.5 text-black/50 hover:bg-yellow-400 hover:text-black dark:text-white/50">
                        Edit
                      </button>
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
        </div>
      </AdminCard>

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
