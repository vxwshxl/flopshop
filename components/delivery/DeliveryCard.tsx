"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MapPin, Phone, Package, QrCode, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { setOrderStatusAction, confirmUpiToShopAction } from "@/app/admin/orders/actions";
import { OrderStatusBadge } from "@/components/store/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatCurrency, formatTime } from "@/lib/utils/formatters";
import type { Order } from "@/lib/types";

export function DeliveryCard({ order, currency }: { order: Order; currency: string }) {
  const [pending, startTransition] = useTransition();
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");
  // Shop-UPI payment (delivery person can't take UPI → customer pays the shop).
  const [showUpi, setShowUpi] = useState(false);
  const [upiOtp, setUpiOtp] = useState("");
  const [upiPaid, setUpiPaid] = useState(false);
  const router = useRouter();

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

  async function confirmDelivery() {
    startTransition(async () => {
      try {
        const res = await setOrderStatusAction(order.id, "delivered", otp);
        if (!res.ok) {
          toast.error(res.error ?? "Failed");
          return;
        }
        toast.success("Marked delivered 🎉");
        setShowOtp(false);
        setOtp("");
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

  return (
    <div className="glass rounded-2xl p-4 transition-all hover:border-lime-400/30">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-white">{order.order_number}</p>
          <p className="text-xs text-stone-500">{formatTime(order.created_at)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-stone-400">
        <p className="font-medium text-white">{order.customer_name}</p>
        {order.customer_room && (
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-lime-400/70" /> Room {order.customer_room}
          </p>
        )}
        {order.customer_phone && (
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-lime-400/70" />
            <a href={`tel:${order.customer_phone}`} className="hover:underline">
              {order.customer_phone}
            </a>
          </p>
        )}
        <p className="flex items-center gap-2">
          <Package className="h-4 w-4 text-lime-400/70" />
          {order.order_items?.length ?? 0} item{(order.order_items?.length ?? 0) > 1 ? "s" : ""} ·{" "}
          {formatCurrency(order.total_amount, currency)} · {order.payment_method.toUpperCase()}
        </p>
      </div>

      {order.order_items && order.order_items.length > 0 && (
        <div className="mt-2 rounded-lg bg-black/30 p-2 text-xs text-stone-500">
          {order.order_items.map((it) => (
            <span key={it.id} className="mr-2">
              {it.product_name} ×{it.quantity}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-lime-400">
          You earn {formatCurrency(order.delivery_person_earning, currency)}
        </span>
        <div className="flex gap-2">
          <Link href={`/orders/${order.id}`}>
            <Button size="sm" variant="outline">
              Details
            </Button>
          </Link>
          {order.status !== "out_for_delivery" && order.status !== "delivered" && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => update("out_for_delivery")}>
              Pick up
            </Button>
          )}
          {order.status !== "delivered" && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setShowUpi(true)}>
              <QrCode className="h-4 w-4" /> UPI to shop
            </Button>
          )}
          {order.status !== "delivered" && (
            <Button size="sm" disabled={pending} onClick={() => update("delivered")}>
              Mark delivered
            </Button>
          )}
        </div>
      </div>

      <Modal open={showOtp} onClose={() => setShowOtp(false)} title="Enter delivery OTP">
        <p className="mb-4 text-sm text-stone-400">
          Ask the customer for their 4-digit order OTP and enter it here before marking the delivery complete.
        </p>
        <label className="mb-2 block text-sm font-medium text-white">OTP code</label>
        <Input
          value={otp}
          onChange={(event) => setOtp(event.target.value)}
          placeholder="1234"
          maxLength={4}
          className="mb-4 w-full"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowOtp(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={pending || otp.trim().length !== 4} onClick={confirmDelivery}>
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
            {/* Big, high-contrast QR so the customer can scan it straight off
                the delivery person's screen without fuss. */}
            <div className="mb-4 rounded-2xl bg-white p-5 text-center shadow-lg">
              <p className="text-sm font-semibold text-stone-500">Scan &amp; pay the shop</p>
              <p className="text-3xl font-extrabold text-stone-900">{formatCurrency(order.total_amount, currency)}</p>
              <div className="mt-3 flex justify-center">
                <Image
                  src="/QR.jpeg"
                  alt="Shop UPI QR code — scan to pay"
                  width={320}
                  height={320}
                  className="h-auto w-full max-w-[300px]"
                  priority
                />
              </div>
              <p className="mt-2 text-xs text-stone-500">Open any UPI app → scan → pay</p>
            </div>
            <p className="mb-2 text-sm text-stone-400">
              Once paid, ask the customer for their 4-digit OTP and enter it to confirm payment &amp; complete delivery.
            </p>
            <Input
              value={upiOtp}
              onChange={(e) => setUpiOtp(e.target.value)}
              placeholder="1234"
              maxLength={4}
              className="mb-4 w-full"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeUpi} disabled={pending}>
                Cancel
              </Button>
              <Button disabled={pending || upiOtp.trim().length !== 4} onClick={confirmUpiPayment}>
                Confirm payment
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
