"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  setOrderStatusAction,
  assignDeliveryAction,
  setPaymentStatusAction,
  updateOrderItemsAction,
} from "@/app/admin/orders/actions";
import { AdminCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatCurrency } from "@/lib/utils/formatters";
import { adminSettableStatuses, statusLabel, nextStatuses } from "@/lib/utils/orderHelpers";
import type { Order, OrderItem, OrderStatus, Profile } from "@/lib/types";

export function OrderManagePanel({
  order,
  deliveryPeople,
}: {
  order: Order;
  deliveryPeople: Pick<Profile, "id" | "full_name">[];
}) {
  const [pending, startTransition] = useTransition();
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [statusTarget, setStatusTarget] = useState<OrderStatus | null>(null);
  const [showItems, setShowItems] = useState(false);
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    startTransition(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          toast.error(res.error ?? "Failed");
          return;
        }
        toast.success(ok);
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });

  function requestStatusChange(status: OrderStatus) {
    // Only online orders carry an OTP. Manual / walk-in orders have none, so the
    // admin completes them directly without the OTP prompt.
    if (status === "delivered" && !order.is_manual && order.otp_code) {
      setStatusTarget(status);
      setOtp("");
      setShowOtpModal(true);
      return;
    }
    if (status === "cancelled") {
      setStatusTarget(status);
      setCancelReason("");
      setShowCancelModal(true);
      return;
    }
    run(() => setOrderStatusAction(order.id, status), `Marked ${statusLabel(status, order.order_type)}`);
  }

  async function confirmOtpUpdate() {
    if (!statusTarget) return;
    startTransition(async () => {
      try {
        const res = await setOrderStatusAction(order.id, statusTarget, otp);
        if (!res.ok) {
          toast.error(res.error ?? "Failed");
          return;
        }
        toast.success(`Marked ${statusLabel(statusTarget, order.order_type)}`);
        setShowOtpModal(false);
        setOtp("");
        setStatusTarget(null);
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  async function confirmCancel() {
    if (!statusTarget) return;
    if (!cancelReason.trim()) {
      toast.error("Please provide a cancellation reason.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await setOrderStatusAction(order.id, statusTarget, undefined, cancelReason.trim());
        if (!res.ok) {
          toast.error(res.error ?? "Failed");
          return;
        }
        toast.success(`Order cancelled`);
        setShowCancelModal(false);
        setCancelReason("");
        setStatusTarget(null);
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  const isDelivery = order.order_type === "delivery";
  // Admin can't dispatch/complete a delivery order — that's the delivery partner's job.
  const next = nextStatuses(order.status, order.order_type).filter(
    (s) => !(isDelivery && (s === "out_for_delivery" || s === "delivered"))
  );
  const settable = adminSettableStatuses(order.order_type);
  // Keep the current status visible in the dropdown even if admin can't set it.
  const statusOptions = settable.includes(order.status) ? settable : [order.status, ...settable];
  // Delivered = OTP-verified, cancelled = terminal. Both are final: no edits.
  const finalized = order.status === "delivered" || order.status === "cancelled";

  return (
    <AdminCard title="Manage Order">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-black/50 dark:text-white/50">Quick actions</p>
          <div className="flex flex-wrap gap-2">
            {next.length === 0 && <span className="text-sm text-black/50 dark:text-white/50">No further actions.</span>}
            {next.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={s === "cancelled" ? "danger" : "dark"}
                disabled={pending}
                onClick={() => requestStatusChange(s)}
              >
                {s === "cancelled" ? "Cancel order" : `Mark ${statusLabel(s, order.order_type)}`}
              </Button>
            ))}
          </div>
          {isDelivery && (
            <p className="mt-2 text-xs text-black/50 dark:text-white/50">
              Dispatch &amp; delivery completion are done by the assigned delivery partner.
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase text-black/50 dark:text-white/50">Set status</p>
          <Select
            value={order.status}
            disabled={pending || finalized}
            onChange={(e) => requestStatusChange(e.target.value as OrderStatus)}
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s, order.order_type)}
              </option>
            ))}
          </Select>
          {finalized && (
            <p className="mt-2 text-xs text-black/50 dark:text-white/50">
              {order.status === "delivered"
                ? "Order is complete (OTP verified) — status is locked."
                : "Order is cancelled — status is locked."}
            </p>
          )}
        </div>

        {order.order_type === "delivery" && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-black/50 dark:text-white/50">Delivery person</p>
            <Select
              value={order.delivery_person_id ?? ""}
              disabled={pending}
              onChange={(e) =>
                run(() => assignDeliveryAction(order.id, e.target.value || null), "Assigned")
              }
            >
              <option value="">Unassigned</option>
              {deliveryPeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name ?? "Staff"}
                </option>
              ))}
            </Select>
          </div>
        )}

        {order.status !== "cancelled" && (order.order_items?.length ?? 0) > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-black/50 dark:text-white/50">Items</p>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setShowItems(true)}>
              Edit items
            </Button>
            <p className="mt-2 text-xs text-black/50 dark:text-white/50">
              Swap a flavour or fix quantity/price — the customer sees the update live.
            </p>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium uppercase text-black/50 dark:text-white/50">Payment</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={order.payment_status === "paid" ? "dark" : "outline"}
              disabled={pending}
              onClick={() => run(() => setPaymentStatusAction(order.id, "paid"), "Marked paid")}
            >
              Paid
            </Button>
            <Button
              size="sm"
              variant={order.payment_status === "pending" ? "dark" : "outline"}
              disabled={pending}
              onClick={() => run(() => setPaymentStatusAction(order.id, "pending"), "Marked pending")}
            >
              Pending
            </Button>
          </div>
        </div>
      </div>

      <Modal open={showOtpModal} onClose={() => setShowOtpModal(false)} title="Enter order OTP">
        <p className="mb-4 text-sm text-gray-300">
          Ask the customer for their 4-digit order OTP and enter it here to complete the order.
        </p>
        <label className="mb-2 block text-sm font-medium text-white">Order OTP</label>
        <Input
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="1234"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={4}
          className="mb-4 w-full tracking-[0.4em]"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowOtpModal(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={pending || otp.trim().length !== 4} onClick={confirmOtpUpdate}>
            Confirm OTP
          </Button>
        </div>
      </Modal>

      {showItems && (
        <EditItemsModal
          order={order}
          onClose={() => setShowItems(false)}
          onSaved={() => {
            setShowItems(false);
            router.refresh();
          }}
        />
      )}

      <Modal open={showCancelModal} onClose={() => setShowCancelModal(false)} title="Cancellation reason">
        <p className="mb-4 text-sm text-gray-300">
          Tell the customer why this order cannot be fulfilled. This reason is saved with the cancelled order.
        </p>
        <label className="mb-2 block text-sm font-medium text-white">Reason</label>
        <Input
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          placeholder="e.g. item out of stock"
          className="mb-4 w-full"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowCancelModal(false)} disabled={pending}>
            Back
          </Button>
          <Button disabled={pending || !cancelReason.trim()} onClick={confirmCancel}>
            Cancel order
          </Button>
        </div>
      </Modal>
    </AdminCard>
  );
}

function EditItemsModal({
  order,
  onClose,
  onSaved,
}: {
  order: Order;
  onClose: () => void;
  onSaved: () => void;
}) {
  const currency = "₹";
  const [rows, setRows] = useState(
    (order.order_items ?? []).map((it: OrderItem) => ({
      id: it.id,
      product_name: it.product_name,
      quantity: String(it.quantity),
      unit_price: String(it.unit_price),
    }))
  );
  const [saving, setSaving] = useState(false);

  const set = (id: string, key: "product_name" | "quantity" | "unit_price", value: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));

  const total = rows.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.unit_price) || 0), 0);

  async function save() {
    setSaving(true);
    const res = await updateOrderItemsAction(
      order.id,
      rows.map((r) => ({
        id: r.id,
        product_name: r.product_name,
        quantity: Number(r.quantity) || 1,
        unit_price: Number(r.unit_price) || 0,
      }))
    );
    setSaving(false);
    if (!res.ok) return toast.error(res.error ?? "Failed to save.");
    toast.success("Items updated");
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title="Edit order items">
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-white/10 p-3">
            <Label className="text-gray-300">Item</Label>
            <Input value={r.product_name} onChange={(e) => set(r.id, "product_name", e.target.value)} className="mb-2" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300">Qty</Label>
                <Input type="number" min="1" value={r.quantity} onChange={(e) => set(r.id, "quantity", e.target.value)} />
              </div>
              <div>
                <Label className="text-gray-300">Unit price ({currency})</Label>
                <Input type="number" min="0" step="0.01" value={r.unit_price} onChange={(e) => set(r.id, "unit_price", e.target.value)} />
              </div>
            </div>
          </div>
        ))}
        <p className="text-sm text-gray-400">
          New items total: <span className="font-semibold text-white">{formatCurrency(total, currency)}</span>
          <span className="text-gray-500"> (delivery fee unchanged)</span>
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="outline" className="w-full" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="w-full" onClick={save} disabled={saving}>Save changes</Button>
        </div>
      </div>
    </Modal>
  );
}
