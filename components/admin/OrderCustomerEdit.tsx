"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { updateOrderCustomerAction } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { Order } from "@/lib/types";

/** "Edit" button (for the Customer card header) + the edit-customer modal. */
export function OrderCustomerEdit({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    customer_name: order.customer_name ?? "",
    customer_phone: order.customer_phone ?? "",
    customer_room: order.customer_room ?? "",
  });
  const router = useRouter();

  function openModal() {
    setForm({
      customer_name: order.customer_name ?? "",
      customer_phone: order.customer_phone ?? "",
      customer_room: order.customer_room ?? "",
    });
    setOpen(true);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_name.trim()) {
      toast.error("Customer name is required.");
      return;
    }
    startTransition(async () => {
      const res = await updateOrderCustomerAction(order.id, {
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_room: form.customer_room,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to update customer.");
        return;
      }
      toast.success("Customer updated");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={openModal}>
        Edit
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit customer">
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label htmlFor="oc-name">Name *</Label>
            <Input
              id="oc-name"
              value={form.customer_name}
              onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="oc-phone">Phone</Label>
              <Input
                id="oc-phone"
                value={form.customer_phone}
                inputMode="numeric"
                onChange={(e) =>
                  setForm((f) => ({ ...f, customer_phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))
                }
              />
            </div>
            <div>
              <Label htmlFor="oc-room">Room</Label>
              <Input
                id="oc-room"
                value={form.customer_room}
                onChange={(e) => setForm((f) => ({ ...f, customer_room: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
