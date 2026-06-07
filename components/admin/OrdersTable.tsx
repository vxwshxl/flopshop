"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import toast from "react-hot-toast";
import { setOrderStatusAction, assignDeliveryAction } from "@/app/admin/orders/actions";
import { OrderStatusBadge } from "@/components/store/OrderStatusBadge";
import { Select } from "@/components/ui/input";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import { ORDER_STATUSES, STATUS_LABELS } from "@/lib/utils/orderHelpers";
import type { Order, OrderStatus, Profile } from "@/lib/types";

type Row = Order & {
  order_items?: { id: string }[];
  delivery_person?: Pick<Profile, "id" | "full_name"> | null;
};

const TABS: ("all" | OrderStatus)[] = ["all", ...ORDER_STATUSES];

export function OrdersTable({
  orders,
  deliveryPeople,
  currency,
}: {
  orders: Row[];
  deliveryPeople: Pick<Profile, "id" | "full_name" | "role">[];
  currency: string;
}) {
  const [tab, setTab] = useState<"all" | OrderStatus>("all");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    ORDER_STATUSES.forEach((s) => (c[s] = orders.filter((o) => o.status === s).length));
    return c;
  }, [orders]);

  const filtered = useMemo(
    () =>
      orders.filter(
        (o) =>
          (tab === "all" || o.status === tab) &&
          (o.order_number.toLowerCase().includes(query.toLowerCase()) ||
            o.customer_name.toLowerCase().includes(query.toLowerCase()))
      ),
    [orders, tab, query]
  );

  function changeStatus(id: string, status: OrderStatus) {
    startTransition(async () => {
      const res = await setOrderStatusAction(id, status);
      if (!res.ok) toast.error(res.error ?? "Failed");
      else toast.success("Status updated");
    });
  }

  function assign(id: string, personId: string) {
    startTransition(async () => {
      const res = await assignDeliveryAction(id, personId || null);
      if (!res.ok) toast.error(res.error ?? "Failed");
      else toast.success("Delivery person assigned");
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              tab === t
                ? "bg-yellow-400 text-black"
                : "border border-black/10 bg-white text-black/60 hover:text-black dark:border-white/10 dark:bg-black dark:text-white/60 dark:hover:text-white"
            }`}
          >
            {t === "all" ? "All" : STATUS_LABELS[t]}{" "}
            <span className="opacity-60">({counts[t] ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search order # or customer…"
          className="h-10 w-full rounded-lg border border-black/15 bg-white pl-9 pr-3 text-sm text-black placeholder:text-black/40 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 dark:border-white/15 dark:bg-black dark:text-white dark:placeholder:text-white/40"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-black">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs text-black/50 dark:border-white/10 dark:text-white/50">
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Type</th>
              <th className="p-3">Items</th>
              <th className="p-3">Total</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
              <th className="p-3">Update</th>
              <th className="p-3">Delivery</th>
            </tr>
          </thead>
          <tbody className="text-black/75 dark:text-white/75">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-black/50 dark:text-white/50">
                  No orders.
                </td>
              </tr>
            )}
            {filtered.map((o) => (
              <tr key={o.id} className="border-b border-black/10 last:border-0 hover:bg-yellow-400/10 dark:border-white/10">
                <td className="p-3">
                  <Link href={`/admin/orders/${o.id}`} className="font-medium text-black underline decoration-yellow-400 underline-offset-4 dark:text-white">
                    {o.order_number}
                  </Link>
                </td>
                <td className="p-3">
                  {o.customer_name}
                  {o.is_manual && <span className="ml-1 text-[10px] text-black/50 dark:text-white/50">(walk-in)</span>}
                </td>
                <td className="p-3 capitalize">{o.order_type}</td>
                <td className="p-3">{o.order_items?.length ?? 0}</td>
                <td className="p-3">{formatCurrency(o.total_amount, currency)}</td>
                <td className="p-3">
                  <OrderStatusBadge status={o.status} />
                </td>
                <td className="p-3 whitespace-nowrap text-xs text-black/50 dark:text-white/50">{formatDateTime(o.created_at)}</td>
                <td className="p-3">
                  <Select
                    value={o.status}
                    disabled={pending}
                    onChange={(e) => changeStatus(o.id, e.target.value as OrderStatus)}
                    className="min-w-36"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="p-3">
                  {o.order_type === "delivery" ? (
                    <Select
                      value={o.delivery_person_id ?? ""}
                      disabled={pending}
                      onChange={(e) => assign(o.id, e.target.value)}
                      className="min-w-40"
                    >
                      <option value="">Unassigned</option>
                      {deliveryPeople.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name ?? "Staff"}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <span className="text-xs text-black/40 dark:text-white/40">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
