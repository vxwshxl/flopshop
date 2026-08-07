"use client";

import Link from "next/link";
import { OrderStatusBadge } from "@/components/store/OrderStatusBadge";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { formatCurrency, formatDateTime, formatPaymentMethod } from "@/lib/utils/formatters";
import type { Order } from "@/lib/types";

/**
 * Paginated list of a single user's (or customer's) orders, newest first.
 * `backTo` is the page being viewed from — passed along so the order detail's
 * back link returns here instead of the full orders list.
 */
export function UserOrdersTable({
  orders,
  currency,
  emptyText = "This user has no orders yet.",
  backTo,
}: {
  orders: Order[];
  currency: string;
  emptyText?: string;
  backTo?: string;
}) {
  const orderHref = (orderId: string) =>
    backTo ? `/admin/orders/${orderId}?from=${encodeURIComponent(backTo)}` : `/admin/orders/${orderId}`;
  const { page, setPage, perPage, setPerPage, total, totalPages, pageItems } = usePagination(orders, 10);

  if (orders.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/50">{emptyText}</p>;
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-black/15 dark:border-white/15">
        <table className="w-full min-w-[42rem] text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs text-black/50 dark:border-white/10 dark:text-white/50">
              <th className="p-3">Order</th>
              <th className="p-3">Type</th>
              <th className="p-3">Payment</th>
              <th className="p-3">Total</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
            </tr>
          </thead>
          <tbody className="text-black/75 dark:text-white/75">
            {pageItems.map((o) => (
              <tr key={o.id} className="border-b border-black/10 last:border-0 hover:bg-yellow-400/10 dark:border-white/10">
                <td className="p-3">
                  <Link href={orderHref(o.id)} className="font-medium text-black underline decoration-yellow-400 underline-offset-4 dark:text-white">
                    {o.order_number}
                  </Link>
                </td>
                <td className="p-3 capitalize">{o.order_type}</td>
                <td className="p-3 whitespace-nowrap text-xs text-black/60 dark:text-white/60">
                  {formatPaymentMethod(o, currency)} · {o.payment_status}
                </td>
                <td className="num p-3">{formatCurrency(o.total_amount, currency)}</td>
                <td className="p-3"><OrderStatusBadge status={o.status} /></td>
                <td className="p-3 whitespace-nowrap text-xs text-black/50 dark:text-white/50">{formatDateTime(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        perPage={perPage}
        total={total}
        onPage={setPage}
        onPerPage={setPerPage}
        pageSizes={[10, 20, 50]}
      />
    </>
  );
}
