"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { createCustomerAction, updateCustomerAction } from "@/app/admin/customers/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { Customer, Hostel } from "@/lib/types";

const empty = { name: "", phone: "", email: "", room_number: "", hostel_block: "" };

function formFor(customer: Customer | null) {
  if (!customer) return empty;
  return {
    name: customer.name,
    phone: customer.phone,
    email: customer.email ?? "",
    room_number: customer.room_number ?? "",
    hostel_block: customer.hostel_block ?? "",
  };
}

/**
 * Add/edit form for a customer record. Shared by the customers table and the
 * customer detail page so both edit through the same validation and actions.
 * `customer` null means "add"; `onSaved` receives the saved row.
 */
export function CustomerFormModal({
  open,
  onClose,
  customer,
  hostels,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  hostels: Hostel[];
  onSaved: (customer: Customer) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={customer ? "Edit customer" : "Add customer"}>
      {/* Keyed so the fields reload whenever the modal opens on another record. */}
      <CustomerFields
        key={customer?.id ?? "new"}
        customer={customer}
        hostels={hostels}
        onCancel={onClose}
        onSaved={onSaved}
      />
    </Modal>
  );
}

function CustomerFields({
  customer,
  hostels,
  onCancel,
  onSaved,
}: {
  customer: Customer | null;
  hostels: Hostel[];
  onCancel: () => void;
  onSaved: (customer: Customer) => void;
}) {
  const [form, setForm] = useState(() => formFor(customer));
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      return toast.error("Name and phone are required.");
    }
    setSaving(true);
    const res = customer
      ? await updateCustomerAction(customer.id, form)
      : await createCustomerAction(form);
    setSaving(false);
    if (!res.ok || !res.customer) return toast.error(res.error ?? "Failed to save customer.");

    toast.success(customer ? "Customer updated." : "Customer added.");
    onSaved(res.customer);
  }

  return (
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
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {customer ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}
