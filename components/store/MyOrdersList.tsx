"use client";

import Link from "next/link";
import { OrderStatusBadge } from "@/components/store/OrderStatusBadge";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import type { Order } from "@/lib/types";

export function MyOrdersList({ orders, currency }: { orders: Order[]; currency: string }) {
  const { page, setPage, perPage, setPerPage, total, totalPages, pageItems } = usePagination(orders, 10);

  return (
    <>
      <div className="space-y-3">
        {pageItems.map((o) => (
          <Link
            key={o.id}
            href={`/orders/${o.id}`}
            className="block rounded-lg border border-black/10 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-stone-900"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-950 dark:text-white">{o.order_number}</span>
              <OrderStatusBadge status={o.status} />
            </div>
            <div className="mt-1 flex items-center justify-between text-sm text-stone-600 dark:text-stone-400">
              <span>
                {o.order_items?.length ?? 0} item{(o.order_items?.length ?? 0) > 1 ? "s" : ""} ·{" "}
                {o.order_type === "delivery" ? "Delivery" : "Pickup"}
              </span>
              <span className="font-semibold text-stone-950 dark:text-white">
                {formatCurrency(o.total_amount, currency)}
              </span>
            </div>
            <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">{formatDateTime(o.created_at)}</p>
          </Link>
        ))}
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
