"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  setOrderStatusAction,
  assignDeliveryAction,
  setPaymentStatusAction,
  setPaymentMethodAction,
  setOrderTypeAction,
  setAmountPaidAction,
} from "@/app/admin/orders/actions";
import { AdminCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/formatters";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { adminSettableStatuses, statusLabel, nextStatuses } from "@/lib/utils/orderHelpers";
import type { Order, OrderStatus, OrderType, Profile } from "@/lib/types";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  split: "Split (Cash + UPI)",
  credit: "Pay by credit (wallet)",
  "bank transfer": "Bank Transfer",
  other: "Other",
};

// Same set the manual-order form offers, so an order can be relabelled to any of them.
const METHOD_OPTIONS = ["cash", "upi", "split", "credit", "bank transfer", "other"];

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
  const [amountPaid, setAmountPaid] = useState(String(order.amount_paid ?? ""));
  // Payment-method picker: split/credit need a confirm step, so the dropdown
  // only stages a choice and a Save below commits it. Single methods save at once.
  const [methodDraft, setMethodDraft] = useState((order.payment_method ?? "").toLowerCase());
  const [splitCash, setSplitCash] = useState(String(order.paid_cash ?? ""));
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
  // completed walk-in was actually paid). Any current value not in the standard
  // set is still shown first so nothing is silently dropped.
  const paymentMethod = (order.payment_method ?? "").toLowerCase();
  const methodOptions = METHOD_OPTIONS.includes(paymentMethod)
    ? METHOD_OPTIONS
    : [paymentMethod, ...METHOD_OPTIONS];
  const total = Number(order.total_amount);
  const splitCashNum = Math.min(Math.max(Number(splitCash) || 0, 0), total);

  function onMethodChange(m: string) {
    setMethodDraft(m);
    // Split & credit open an inline confirm; everything else saves immediately.
    if (m !== "split" && m !== "credit") {
      run(() => setPaymentMethodAction(order.id, m), "Payment method updated");
    }
  }

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
          <p className="mb-2 text-xs font-medium uppercase text-black/50 dark:text-white/50">Order type</p>
          <Select
            value={order.order_type}
            disabled={pending}
            onChange={(e) => run(() => setOrderTypeAction(order.id, e.target.value as OrderType), "Order type updated")}
          >
            <option value="pickup">Pickup</option>
            <option value="delivery">Delivery</option>
          </Select>
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

        <div>
          <p className="mb-2 text-xs font-medium uppercase text-black/50 dark:text-white/50">Payment method</p>
          <Select value={methodDraft} disabled={pending} onChange={(e) => onMethodChange(e.target.value)}>
            {methodOptions.map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m] ?? m}
              </option>
            ))}
          </Select>

          {/* Split needs the cash/UPI breakdown before it can be saved. */}
          {methodDraft === "split" && (
            <div className="mt-3 space-y-2 rounded-lg border border-black/10 p-3 dark:border-white/10">
              <p className="text-xs text-black/50 dark:text-white/50">Cash collected (UPI is the rest)</p>
              <Input
                type="number"
                inputMode="numeric"
                value={splitCash}
                onChange={(e) => setSplitCash(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-black/60 dark:text-white/60">
                Cash {formatCurrency(splitCashNum)} · UPI {formatCurrency(Math.max(total - splitCashNum, 0))}
              </p>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => run(() => setPaymentMethodAction(order.id, "split", { paidCash: splitCashNum }), "Saved as split")}
              >
                Save split
              </Button>
            </div>
          )}

          {/* Pay-by-credit charges the whole order to the customer's wallet. */}
          {methodDraft === "credit" && (
            <div className="mt-3 space-y-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-400/20 dark:bg-amber-400/10">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Charges {formatCurrency(total)} to {order.customer_name || "the customer"}&apos;s store credit. If they
                don&apos;t have enough, the balance goes negative (they owe the shop).
              </p>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => run(() => setPaymentMethodAction(order.id, "credit"), "Charged to store credit")}
              >
                Charge store credit
              </Button>
            </div>
          )}
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

          {/* Partial payment — record how much has actually been collected. */}
          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <p className="mb-1 text-xs text-black/50 dark:text-white/50">Amount paid (of {formatCurrency(order.total_amount)})</p>
              <Input
                type="number"
                inputMode="numeric"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0"
              />
            </div>
            <Button size="sm" disabled={pending} onClick={() => run(() => setAmountPaidAction(order.id, Number(amountPaid) || 0), "Payment recorded")}>
              Save
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-black/50 dark:text-white/50">
            Saving settles the order. Anything over {formatCurrency(total)} is kept as the customer&apos;s store
            credit; anything short is recorded as credit they owe the shop.
          </p>
          {order.payment_status === "partial" && (
            <p className="mt-1.5 text-xs font-medium text-amber-500">
              Partial: {formatCurrency(order.amount_paid)} paid ·{" "}
              {formatCurrency(Math.max(Number(order.total_amount) - Number(order.amount_paid), 0))} pending
            </p>
          )}
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
