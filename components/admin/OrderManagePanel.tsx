"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  setOrderStatusAction,
  assignDeliveryAction,
  setPaymentStatusAction,
  setPaymentMethodAction,
  EDITABLE_PAYMENT_METHODS,
} from "@/app/admin/orders/actions";
import { AdminCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EditOrderItemsModal } from "@/components/admin/EditOrderItemsModal";
import { adminSettableStatuses, statusLabel, nextStatuses } from "@/lib/utils/orderHelpers";
import type { Order, OrderStatus, Product, Profile } from "@/lib/types";

type PickerProduct = Pick<Product, "id" | "name" | "selling_price">;

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  "bank transfer": "Bank Transfer",
  other: "Other",
  split: "Split",
};

export function OrderManagePanel({
  order,
  deliveryPeople,
  products,
}: {
  order: Order;
  deliveryPeople: Pick<Profile, "id" | "full_name">[];
  products: PickerProduct[];
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

  // Payment method is editable even on finalized orders (e.g. fixing how a
  // completed walk-in was actually paid). The current value is always shown —
  // including non-editable ones like "split" — so nothing is silently dropped.
  const paymentMethod = (order.payment_method ?? "").toLowerCase();
  const methodOptions = EDITABLE_PAYMENT_METHODS.includes(
    paymentMethod as (typeof EDITABLE_PAYMENT_METHODS)[number]
  )
    ? [...EDITABLE_PAYMENT_METHODS]
    : [paymentMethod, ...EDITABLE_PAYMENT_METHODS];

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
          <p className="mb-2 text-xs font-medium uppercase text-black/50 dark:text-white/50">Payment method</p>
          <Select
            value={paymentMethod}
            disabled={pending}
            onChange={(e) => run(() => setPaymentMethodAction(order.id, e.target.value), "Payment method updated")}
          >
            {methodOptions.map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m] ?? m}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase text-black/50 dark:text-white/50">Payment status</p>
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
        <EditOrderItemsModal
          order={order}
          products={products}
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
