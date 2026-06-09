"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { createHostelAction, deleteHostelAction } from "@/app/admin/hostels/actions";
import { PageHeader, AdminCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/utils/formatters";
import type { Hostel } from "@/lib/types";

export function HostelsManager({ hostels: initialHostels }: { hostels: Hostel[] }) {
  const [hostels, setHostels] = useState(initialHostels);
  const [editing, setEditing] = useState<Hostel | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { page, setPage, perPage, setPerPage, total, totalPages, pageItems } = usePagination(hostels);
  const router = useRouter();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      return toast.error("Enter a hostel name.");
    }

    setAdding(true);
    const res = await createHostelAction(newName.trim());
    setAdding(false);

    if (!res.ok) {
      return toast.error(res.error ?? "Failed to add hostel.");
    }

    toast.success("Hostel added.");
    setHostels([...hostels, res.hostel!]);
    setNewName("");
    setShowAddModal(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this hostel?")) return;

    setDeleting(id);
    const res = await deleteHostelAction(id);
    setDeleting(null);

    if (!res.ok) {
      return toast.error(res.error ?? "Failed to delete hostel.");
    }

    toast.success("Hostel deleted.");
    setHostels(hostels.filter((h) => h.id !== id));
    router.refresh();
  }

  function openEdit(h: Hostel) {
    setEditing(h);
    setNewName(h.name);
    setShowAddModal(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setAdding(true);
    const { updateHostelAction } = await import("@/app/admin/hostels/actions");
    const res = await updateHostelAction(editing.id, newName.trim(), editing.is_active);
    setAdding(false);
    if (!res.ok) return toast.error(res.error ?? "Failed to update hostel.");
    toast.success("Hostel updated.");
    setHostels(hostels.map((h) => (h.id === editing.id ? res.hostel! : h)));
    setShowAddModal(false);
    setEditing(null);
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Hostels"
        subtitle="Manage hostel blocks"
        action={
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4" /> Add hostel
          </Button>
        }
      />

      <AdminCard>
        <div className="overflow-hidden rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-black">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs text-black/50 dark:border-white/10 dark:text-white/50">
                <th className="p-3">Hostel</th>
                <th className="p-3">Created</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-black/75 dark:text-white/75">
              {pageItems.map((h) => (
                <tr key={h.id} className="border-b border-black/10 last:border-0 hover:bg-yellow-400/10 dark:border-white/10">
                  <td className="p-3">
                    <span className="font-medium text-white">{h.name}</span>
                  </td>
                  <td className="p-3 text-black/50 dark:text-white/50">{formatDate(h.created_at)}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      h.is_active
                        ? "border border-yellow-400 bg-yellow-400 text-black"
                        : "border border-black/15 text-black/50 dark:border-white/15 dark:text-white/50"
                    }`}>
                      {h.is_active ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(h)} className="rounded-md p-1.5 text-black/50 hover:bg-yellow-400 hover:text-black dark:text-white/50">
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          const { updateHostelAction } = await import("@/app/admin/hostels/actions");
                          const res = await updateHostelAction(h.id, h.name, !h.is_active);
                          if (!res.ok) return toast.error(res.error ?? "Failed to toggle");
                          setHostels(hostels.map((x) => (x.id === h.id ? res.hostel! : x)));
                          toast.success("Updated");
                          router.refresh();
                        }}
                        className="rounded-md p-1.5 text-black/50 hover:bg-yellow-400 hover:text-black dark:text-white/50"
                      >
                        {h.is_active ? "Disable" : "Enable"}
                      </button>
                      <button onClick={() => handleDelete(h.id)} className="rounded-md p-1.5 text-black/50 hover:bg-yellow-400 hover:text-black dark:text-white/50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} perPage={perPage} total={total} onPage={setPage} onPerPage={setPerPage} />
      </AdminCard>

      <Modal open={showAddModal} onClose={() => { setShowAddModal(false); setEditing(null); }} title={editing ? "Edit hostel" : "Add hostel"}>
        <form onSubmit={editing ? handleSaveEdit : handleAdd} className="space-y-4">
          <div>
            <Label htmlFor="hostel-name">Hostel name</Label>
            <Input
              id="hostel-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Heyansh House"
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
