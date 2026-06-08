"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import toast from "react-hot-toast";
import {
  createCustomerAction,
  updateCustomerAction,
  deleteCustomerAction,
} from "@/app/admin/customers/actions";
import { PageHeader, AdminCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination, usePagination } from "@/components/ui/pagination";
import type { Customer, Hostel } from "@/lib/types";

const empty = { name: "", phone: "", email: "", room_number: "", hostel_block: "" };

export function CustomersManager({ customers: initial, hostels }: { customers: Customer[]; hostels: Hostel[] }) {
  const [customers, setCustomers] = useState(initial);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();
  const { page, setPage, perPage, setPerPage, total, totalPages, pageItems } = usePagination(customers);

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

  async function handleDelete(id: string) {
    if (!confirm("Delete this customer?")) return;
    setDeleting(id);
    const res = await deleteCustomerAction(id);
    setDeleting(null);
    if (!res.ok) return toast.error(res.error ?? "Failed to delete customer.");
    setCustomers((list) => list.filter((c) => c.id !== id));
    toast.success("Customer deleted.");
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Walk-in customers for manual orders"
        action={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add customer
          </Button>
        }
      />

      <AdminCard>
        <div className="overflow-hidden rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-black">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs text-black/50 dark:border-white/10 dark:text-white/50">
                <th className="p-3">Name</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Room</th>
                <th className="p-3">Hostel</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-black/75 dark:text-white/75">
              {customers.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-black/50 dark:text-white/50">
                    No customers yet.
                  </td>
                </tr>
              )}
              {pageItems.map((c) => (
                <tr key={c.id} className="border-b border-black/10 last:border-0 hover:bg-yellow-400/10 dark:border-white/10">
                  <td className="p-3 font-medium text-white">{c.name}</td>
                  <td className="p-3">{c.phone}</td>
                  <td className="p-3 text-black/50 dark:text-white/50">{c.room_number ?? "—"}</td>
                  <td className="p-3 text-black/50 dark:text-white/50">{c.hostel_block ?? "—"}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(c)} className="rounded-md p-1.5 text-black/50 hover:bg-yellow-400 hover:text-black dark:text-white/50">
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deleting === c.id}
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
        <Pagination page={page} totalPages={totalPages} perPage={perPage} total={total} onPage={setPage} onPerPage={setPerPage} />
      </AdminCard>

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
    </div>
  );
}
