"use client";

import { useTransition } from "react";
import toast from "react-hot-toast";
import {
  setOrderStatusAction,
  assignDeliveryAction,
  setPaymentStatusAction,
} from "@/app/admin/orders/actions";
import { AdminCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { ORDER_STATUSES, STATUS_LABELS, nextStatuses } from "@/lib/utils/orderHelpers";
import type { Order, OrderStatus, Profile } from "@/lib/types";

export function OrderManagePanel({
  order,
  deliveryPeople,
}: {
  order: Order;
  deliveryPeople: Pick<Profile, "id" | "full_name">[];
}) {
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Failed");
      else toast.success(ok);
    });

  const next = nextStatuses(order.status, order.order_type);

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
                onClick={() => run(() => setOrderStatusAction(order.id, s), `Marked ${STATUS_LABELS[s]}`)}
              >
                {s === "cancelled" ? "Cancel order" : `Mark ${STATUS_LABELS[s]}`}
              </Button>
            ))}
          </div>
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
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
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
