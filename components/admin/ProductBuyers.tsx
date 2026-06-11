"use client";

import Link from "next/link";
import { AdminCard } from "@/components/admin/StatCard";
import { OrderStatusBadge } from "@/components/store/OrderStatusBadge";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import type { OrderStatus } from "@/lib/types";

export type BuyerRow = {
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string | null;
  customer_room: string | null;
  created_at: string;
  status: OrderStatus;
  is_manual: boolean;
  quantity: number;
  total_price: number;
};

/**
 * "Who bought this product" — every order line for this product, newest first.
 * Cancelled lines are shown (greyed via the status badge) but excluded from the
 * units/revenue totals since no sale actually completed.
 */
export function ProductBuyers({ buyers, currency }: { buyers: BuyerRow[]; currency: string }) {
  const sold = buyers.filter((b) => b.status !== "cancelled");
  const unitsSold = sold.reduce((s, b) => s + b.quantity, 0);
  const revenue = sold.reduce((s, b) => s + b.total_price, 0);
  const distinctBuyers = new Set(
    sold.map((b) => (b.customer_phone?.trim() || b.customer_name.trim().toLowerCase()))
  ).size;

  const { page, setPage, perPage, setPerPage, total, totalPages, pageItems } = usePagination(buyers, 10);

  return (
    <AdminCard title="Who bought this">
      {buyers.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No one has ordered this product yet.</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Stat label="Units sold" value={String(unitsSold)} />
            <Stat label="Revenue" value={formatCurrency(revenue, currency)} />
            <Stat label="Buyers" value={String(distinctBuyers)} />
          </div>
          <div className="overflow-x-auto rounded-lg border border-black/15 dark:border-white/15">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-xs text-black/50 dark:border-white/10 dark:text-white/50">
                  <th className="p-3">Order</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Qty</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody className="text-black/75 dark:text-white/75">
                {pageItems.map((b, i) => (
                  <tr key={`${b.order_id}-${i}`} className="border-b border-black/10 last:border-0 hover:bg-yellow-400/10 dark:border-white/10">
                    <td className="p-3">
                      <Link href={`/admin/orders/${b.order_id}`} className="font-medium text-black underline decoration-yellow-400 underline-offset-4 dark:text-white">
                        {b.order_number}
                      </Link>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {b.customer_name}
                      {b.is_manual && <span className="ml-1 text-[10px] text-black/50 dark:text-white/50">(walk-in)</span>}
                    </td>
                    <td className="p-3 whitespace-nowrap text-xs text-black/60 dark:text-white/60">
                      {b.customer_phone || "—"}
                      {b.customer_room && <span className="block text-black/40 dark:text-white/40">Room {b.customer_room}</span>}
                    </td>
                    <td className="p-3">{b.quantity}</td>
                    <td className="p-3">{formatCurrency(b.total_price, currency)}</td>
                    <td className="p-3"><OrderStatusBadge status={b.status} /></td>
                    <td className="p-3 whitespace-nowrap text-xs text-black/50 dark:text-white/50">{formatDateTime(b.created_at)}</td>
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
      )}
    </AdminCard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 p-3 dark:border-white/10">
      <p className="text-xs text-black/50 dark:text-white/50">{label}</p>
      <p className="mt-1 text-lg font-semibold text-black dark:text-white">{value}</p>
    </div>
  );
}
