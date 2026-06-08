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
import type { Hostel } from "@/lib/types";

export function HostelsManager({ hostels: initialHostels }: { hostels: Hostel[] }) {
  const [hostels, setHostels] = useState(initialHostels);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
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
        <div className="space-y-2">
          {hostels.length === 0 ? (
            <p className="text-sm text-gray-400">No hostels yet.</p>
          ) : (
            hostels.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-900/50 p-3"
              >
                <div>
                  <p className="font-medium text-white">{h.name}</p>
                  <p className="text-xs text-gray-500">{new Date(h.created_at).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => handleDelete(h.id)}
                  disabled={deleting === h.id}
                  className="rounded-lg p-2 text-gray-400 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </AdminCard>

      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add hostel">
        <form onSubmit={handleAdd} className="space-y-4">
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
            <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={adding}>
              Add
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
