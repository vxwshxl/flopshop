"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { QrCode, CheckCircle2, PackageX } from "lucide-react";
import toast from "react-hot-toast";
import {
  setOrderStatusAction,
  confirmUpiToShopAction,
  completeCashDeliveryAction,
} from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { Modal } from "@/components/ui/modal";
import { OutOfStockModal } from "./OutOfStockModal";
import { CantDeliverModal } from "./CantDeliverModal";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/formatters";
import { DOOR_CHANGE_MAX } from "@/lib/utils/orderHelpers";
import type { Order } from "@/lib/types";

/**
 * Everything a delivery partner can do to an order at the door — pick up, take
 * payment on the shop QR, mark delivered — plus the OTP/QR modals behind them.
 * Shared by the queue card and the order detail page so a partner who opened
 * Details isn't stranded without the actions they came for.
 */
export function DeliveryActions({
  order,
  currency,
  detailsHref,
  allowItemFix = false,
  className,
}: {
  order: Order;
  currency: string;
  /** Renders a "Details" button first — omit it on the detail page itself. */
  detailsHref?: string;
  /**
   * Offer the out-of-stock fix. On for the detail page, where the partner can
   * see the full item list next to the button; off on the queue card, which
   * only prints a one-line item summary.
   */
  allowItemFix?: boolean;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");
  // Cash handed over at the door when the partner has no change (blank = exact).
  const [cashReceived, setCashReceived] = useState("");
  // Shop-UPI payment (delivery person can't take UPI → customer pays the shop).
  const [showUpi, setShowUpi] = useState(false);
  const [upiOtp, setUpiOtp] = useState("");
  const [upiPaid, setUpiPaid] = useState(false);
  const [showStock, setShowStock] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const router = useRouter();

  // Wallet-credit orders are already paid for — nothing is collected at the door,
  // so the partner must not be shown the shop QR or a payable amount. A partial
  // credit order (wallet didn't cover the whole total) still has a balance due.
  const amountDue = Math.max(Number(order.total_amount) - Number(order.amount_paid ?? 0), 0);
  const prepaid = order.payment_method === "credit" && amountDue <= 0;

  // "No change" settlement: only cash orders have change to round, and only the
  // difference against the total moves — blank means the exact amount was paid.
  const isCashOrder = (order.payment_method ?? "").toLowerCase() === "cash";
  const total = Number(order.total_amount);
  const received = cashReceived.trim() === "" ? null : Math.max(Number(cashReceived) || 0, 0);
  const changeDelta = received === null ? 0 : Math.round((received - total) * 100) / 100;
  const changeMoves = Math.abs(changeDelta) >= 0.005;
  const changeTooBig = Math.abs(changeDelta) > DOOR_CHANGE_MAX;

  const done = order.status === "delivered" || order.status === "cancelled";

  function update(status: "out_for_delivery" | "delivered") {
    if (status === "delivered") {
      setShowOtp(true);
      return;
    }

    startTransition(async () => {
      try {
        const res = await setOrderStatusAction(order.id, status);
        if (!res.ok) {
          toast.error(res.error ?? "Failed");
          return;
        }
        toast.success("Out for delivery");
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  function closeOtp() {
    setShowOtp(false);
    setCashReceived("");
  }

  async function confirmDelivery() {
    if (changeTooBig) {
      toast.error(`The difference can't be more than ${formatCurrency(DOOR_CHANGE_MAX, currency)}.`);
      return;
    }
    startTransition(async () => {
      try {
        // Only take the wallet path when the cash actually differs from the
        // total — an exact payment is an ordinary completion.
        const res =
          isCashOrder && received !== null && changeMoves
            ? await completeCashDeliveryAction(order.id, otp, received)
            : await setOrderStatusAction(order.id, "delivered", otp);
        if (!res.ok) {
          toast.error(res.error ?? "Failed");
          return;
        }
        toast.success(
          changeMoves
            ? changeDelta > 0
              ? `Delivered · ${formatCurrency(changeDelta, currency)} credited to ${order.customer_name}`
              : `Delivered · ${formatCurrency(-changeDelta, currency)} owed by ${order.customer_name}`
            : "Marked delivered 🎉"
        );
        setShowOtp(false);
        setOtp("");
        setCashReceived("");
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  function confirmUpiPayment() {
    startTransition(async () => {
      try {
        const res = await confirmUpiToShopAction(order.id, upiOtp);
        if (!res.ok) {
          toast.error(res.error ?? "Failed");
          return;
        }
        // Show the proof screen; the card disappears on refresh (now delivered).
        setUpiPaid(true);
        toast.success("Payment confirmed ✓");
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  function closeUpi() {
    setShowUpi(false);
    setUpiOtp("");
    if (upiPaid) {
      setUpiPaid(false);
      router.refresh();
    }
  }

  // Built as a list so the last button can stretch across a half-empty row —
  // which buttons apply varies with status, payment method and caller.
  const actions = [
    detailsHref && (
      <Link key="details" href={detailsHref} className="w-full">
        <Button size="sm" variant="outline" className="w-full">
          Details
        </Button>
      </Link>
    ),
    !done && order.status !== "out_for_delivery" && (
      <Button
        key="pickup"
        size="sm"
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={() => update("out_for_delivery")}
      >
        Pick up
      </Button>
    ),
    allowItemFix && !done && (order.order_items?.length ?? 0) > 0 && (
      <Button
        key="stock"
        size="sm"
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={() => setShowStock(true)}
      >
        <PackageX className="h-4 w-4" /> Out of stock
      </Button>
    ),
    !done && !prepaid && (
      <Button
        key="upi"
        size="sm"
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={() => setShowUpi(true)}
      >
        <QrCode className="h-4 w-4" /> UPI to shop
      </Button>
    ),
    !done && (
      <Button key="deliver" size="sm" className="w-full" disabled={pending} onClick={() => update("delivered")}>
        Mark delivered
      </Button>
    ),
  ].filter(Boolean);

  if (actions.length === 0) return null;

  return (
    <div className={className}>
      <p className="mb-2.5 text-xs font-semibold text-lime-600 dark:text-lime-400">
        You earn {formatCurrency(order.delivery_person_earning, currency)}
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {actions.map((action, i) => (
          // An odd count leaves a gap in the last row — let that button fill it.
          <div key={i} className={cn("w-full", i === actions.length - 1 && i % 2 === 0 && "col-span-2")}>
            {action}
          </div>
        ))}
      </div>

      {/* Kept out of the button grid and worded as a question: dropping an order
          is a last resort, not a peer of "Mark delivered". */}
      {!done && order.delivery_person_id && (
        <button
          type="button"
          onClick={() => setShowDrop(true)}
          disabled={pending}
          className="mt-2.5 w-full text-xs font-medium text-stone-500 underline-offset-2 transition hover:text-red-400 hover:underline disabled:opacity-50"
        >
          Can&apos;t deliver this order?
        </button>
      )}

      {showStock && (
        <OutOfStockModal order={order} currency={currency} onClose={() => setShowStock(false)} />
      )}

      {showDrop && <CantDeliverModal order={order} onClose={() => setShowDrop(false)} />}

      <Modal open={showOtp} onClose={closeOtp} title="Enter delivery OTP">
        <p className="mb-5 text-center text-sm text-stone-400">
          Ask the customer for their 4-digit order OTP.
        </p>
        <OtpInput value={otp} onChange={setOtp} autoFocus />

        {isCashOrder && (
          <div className="mt-5">
            <label htmlFor={`cash-${order.id}`} className="mb-1.5 block text-sm font-medium text-stone-300">
              Cash received — leave blank if exact
            </label>
            <Input
              id={`cash-${order.id}`}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              placeholder={String(total)}
            />
            <p className="mt-1.5 text-xs text-stone-500">
              No change? Enter what they handed over — the difference goes to their wallet.
            </p>
            {changeTooBig ? (
              <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300">
                Difference is over {formatCurrency(DOOR_CHANGE_MAX, currency)}. Collect the exact
                amount, or take the payment on the shop QR instead.
              </p>
            ) : (
              changeMoves && (
                <p
                  className={`mt-2 rounded-lg px-3 py-2 text-xs font-medium ${
                    changeDelta > 0
                      ? "bg-lime-400/10 text-lime-300"
                      : "bg-amber-400/10 text-amber-300"
                  }`}
                >
                  {changeDelta > 0
                    ? `${formatCurrency(changeDelta, currency)} will be added to ${order.customer_name}'s wallet as credit.`
                    : `${formatCurrency(-changeDelta, currency)} short — it will be recorded as owed on ${order.customer_name}'s wallet.`}
                </p>
              )
            )}
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <Button variant="outline" className="w-full" onClick={closeOtp} disabled={pending}>
            Cancel
          </Button>
          <Button
            className="w-full"
            disabled={pending || otp.length !== 4 || changeTooBig}
            onClick={confirmDelivery}
          >
            Confirm delivery
          </Button>
        </div>
      </Modal>

      <Modal open={showUpi} onClose={closeUpi} title={upiPaid ? "Payment confirmed" : "Pay to shop UPI"}>
        {upiPaid ? (
          <div className="flex flex-col items-center py-4 text-center">
            <CheckCircle2 className="h-14 w-14 text-lime-400" />
            <p className="mt-3 text-lg font-bold text-white">
              Paid {formatCurrency(order.total_amount, currency)} via UPI
            </p>
            <p className="mt-1 text-sm text-stone-400">Money received in the shop&apos;s account · Order delivered ✓</p>
            <Button className="mt-5 w-full" onClick={closeUpi}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-col items-center rounded-2xl bg-white p-4 shadow-lg">
              <p className="num max-w-full text-2xl font-extrabold text-stone-900">
                {formatCurrency(order.total_amount, currency)}
              </p>
              <Image
                src="/QR.jpeg"
                alt="Shop UPI QR code — scan to pay"
                width={180}
                height={180}
                className="mt-2 h-auto w-full max-w-[180px]"
                priority
              />
            </div>
            <OtpInput value={upiOtp} onChange={setUpiOtp} autoFocus />
            <div className="mt-6 grid grid-cols-2 gap-2.5">
              <Button variant="outline" className="w-full" onClick={closeUpi} disabled={pending}>
                Cancel
              </Button>
              <Button className="w-full" disabled={pending || upiOtp.length !== 4} onClick={confirmUpiPayment}>
                Confirm payment
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
