"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  setOrderStatusAction,
  assignDeliveryAction,
  setPaymentStatusAction,
} from "@/app/admin/orders/actions";
import { AdminCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { adminSettableStatuses, statusLabel, nextStatuses } from "@/lib/utils/orderHelpers";
import type { Order, OrderStatus, Profile } from "@/lib/types";

export function OrderManagePanel({
  order,
  deliveryPeople,
}: {
  order: Order;
  deliveryPeople: Pick<Profile, "id" | "full_name">[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    startTransition(async () => {
      try {
        const res = await fn();
        if (!res.ok) return toast.error(res.error ?? "Failed");
        toast.success(ok);
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });

  const isDelivery = order.order_type === "delivery";
  // Admin can't dispatch/complete a delivery order — that's the delivery partner's job.
  const next = nextStatuses(order.status, order.order_type).filter(
    (s) => !(isDelivery && (s === "out_for_delivery" || s === "delivered"))
  );
  const settable = adminSettableStatuses(order.order_type);
  // Keep the current status visible in the dropdown even if admin can't set it.
  const statusOptions = settable.includes(order.status) ? settable : [order.status, ...settable];

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
                onClick={() =>
                  run(
                    () => setOrderStatusAction(order.id, s),
                    `Marked ${statusLabel(s, order.order_type)}`
                  )
                }
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
            disabled={pending}
            onChange={(e) =>
              run(() => setOrderStatusAction(order.id, e.target.value as OrderStatus), "Status updated")
            }
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s, order.order_type)}
              </option>
            ))}
          </Select>
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
    </AdminCard>
  );
}
