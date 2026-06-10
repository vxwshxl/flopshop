"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { setOrderStatusAction, assignDeliveryAction } from "@/app/admin/orders/actions";
import { OrderStatusBadge } from "@/components/store/OrderStatusBadge";
import { Select } from "@/components/ui/input";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { TableToolbar, SortHeader } from "@/components/admin/TableControls";
import { TableScroll, tableCardClass, stickyHead } from "@/components/admin/TableShell";
import { useTableControls, byText, byNum, byDate } from "@/lib/hooks/useTableControls";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import { ORDER_STATUSES, STATUS_LABELS, adminSettableStatuses, statusLabel } from "@/lib/utils/orderHelpers";
import type { Order, OrderStatus, Profile } from "@/lib/types";

type Row = Order & {
  order_items?: { id: string; product_name: string }[];
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
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  // Optimistic status per row so the table reflects the change immediately
  // (and survives a flaky revalidation) until fresh server data arrives.
  const [overrides, setOverrides] = useState<Record<string, OrderStatus>>({});
  const statusOf = (o: Row) => overrides[o.id] ?? o.status;

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    ORDER_STATUSES.forEach((s) => (c[s] = orders.filter((o) => o.status === s).length));
    return c;
  }, [orders]);

  const tabbed = useMemo(
    () => (tab === "all" ? orders : orders.filter((o) => o.status === tab)),
    [orders, tab]
  );
  const ctl = useTableControls(tabbed, {
    searchFields: (o) => [
      o.order_number,
      o.customer_name,
      o.invoice_number,
      ...(o.order_items?.map((it) => it.product_name) ?? []),
    ],
    dateField: (o) => o.created_at,
    sorters: {
      order: byText((o) => o.order_number),
      customer: byText((o) => o.customer_name),
      total: byNum((o) => o.total_amount),
      date: byDate((o) => o.created_at),
    },
    initialSort: "date",
    initialDir: "desc",
  });
  const { page, setPage, perPage, setPerPage, total, totalPages, pageItems } = usePagination(ctl.rows);

  function changeStatus(id: string, status: OrderStatus) {
    const prev = overrides[id];
    const revert = () =>
      setOverrides((m) => {
        const n = { ...m };
        if (prev) n[id] = prev;
        else delete n[id];
        return n;
      });
    setOverrides((m) => ({ ...m, [id]: status }));
    startTransition(async () => {
      try {
        const res = await setOrderStatusAction(id, status);
        if (!res.ok) {
          revert();
          toast.error(res.error ?? "Failed");
          return;
        }
        toast.success("Status updated");
        router.refresh();
      } catch {
        revert();
        toast.error("Something went wrong. Please try again.");
      }
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
    <div className={tableCardClass}>
      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-2">
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

      <div className="shrink-0">
        <TableToolbar
          query={ctl.query}
          onQuery={ctl.setQuery}
          placeholder="Search order #, invoice, customer or product…"
          from={ctl.from}
          to={ctl.to}
          onFrom={ctl.setFrom}
          onTo={ctl.setTo}
          hasDateFilter={ctl.hasDateFilter}
          onClearDates={ctl.clearDates}
        />
      </div>

      <TableScroll>
        <table className="w-full text-sm">
          <thead className={stickyHead}>
            <tr className="border-b border-black/10 text-left text-xs text-black/50 dark:border-white/10 dark:text-white/50">
              <SortHeader label="Order" sortKey="order" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} />
              <SortHeader label="Customer" sortKey="customer" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} />
              <th className="p-3">Type</th>
              <th className="p-3">Items</th>
              <SortHeader label="Total" sortKey="total" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} defaultDir="desc" />
              <th className="p-3">Status</th>
              <SortHeader label="Date" sortKey="date" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} defaultDir="desc" />
              <th className="p-3">Update</th>
              <th className="p-3">Delivery</th>
            </tr>
          </thead>
          <tbody className="text-black/75 dark:text-white/75">
            {ctl.rows.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-black/50 dark:text-white/50">
                  No orders.
                </td>
              </tr>
            )}
            {pageItems.map((o) => (
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
                  <OrderStatusBadge status={statusOf(o)} />
                </td>
                <td className="p-3 whitespace-nowrap text-xs text-black/50 dark:text-white/50">{formatDateTime(o.created_at)}</td>
                <td className="p-3">
                  <Select
                    value={statusOf(o)}
                    disabled={pending}
                    onChange={(e) => changeStatus(o.id, e.target.value as OrderStatus)}
                    className="min-w-36"
                  >
                    {(() => {
                      // "Completed" (delivered) is inline-settable for walk-in/manual
                      // pickups (no OTP needed). Online pickups still complete via the
                      // detail page so the OTP can be verified.
                      const available = adminSettableStatuses(o.order_type).filter(
                        (s) => !(o.order_type === "pickup" && s === "delivered" && !o.is_manual)
                      );
                      const options = available.includes(statusOf(o)) ? available : [statusOf(o), ...available];
                      return options.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s, o.order_type)}
                        </option>
                      ));
                    })()}
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
      </TableScroll>
      <div className="shrink-0">
        <Pagination page={page} totalPages={totalPages} perPage={perPage} total={total} onPage={setPage} onPerPage={setPerPage} />
      </div>
    </div>
  );
}
