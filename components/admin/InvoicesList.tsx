"use client";

import Link from "next/link";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { TableToolbar, SortHeader } from "@/components/admin/TableControls";
import { TableScroll, tableCardClass } from "@/components/admin/TableShell";
import { useTableControls, byText, byNum, byDate } from "@/lib/hooks/useTableControls";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import type { Order } from "@/lib/types";

type Row = Order & { order_items?: { id: string }[] };

export function InvoicesList({ orders, currency }: { orders: Row[]; currency: string }) {
  const ctl = useTableControls(orders, {
    searchFields: (o) => [o.invoice_number, o.customer_name, o.order_number],
    dateField: (o) => o.created_at,
    sorters: {
      invoice: byText((o) => o.invoice_number ?? o.order_number),
      customer: byText((o) => o.customer_name),
      date: byDate((o) => o.created_at),
      total: byNum((o) => o.total_amount),
    },
    initialSort: "date",
    initialDir: "desc",
  });
  const { page, setPage, perPage, setPerPage, total, totalPages, pageItems } = usePagination(ctl.rows);

  return (
    <div className={tableCardClass}>
      <div className="shrink-0">
        <TableToolbar
          query={ctl.query}
          onQuery={ctl.setQuery}
          placeholder="Search invoice # or customer…"
          from={ctl.from}
          to={ctl.to}
          onFrom={ctl.setFrom}
          onTo={ctl.setTo}
          hasDateFilter={ctl.hasDateFilter}
          onClearDates={ctl.clearDates}
        />
      </div>

      <TableScroll className="rounded-xl border-[#222] bg-[#1a1a1a]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 [&_th]:bg-[#1a1a1a]">
            <tr className="border-b border-[#222] text-left text-xs text-gray-500">
              <SortHeader label="Invoice #" sortKey="invoice" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} />
              <SortHeader label="Customer" sortKey="customer" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} />
              <SortHeader label="Date" sortKey="date" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} defaultDir="desc" />
              <th className="p-3">Items</th>
              <SortHeader label="Total" sortKey="total" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} defaultDir="desc" />
              <th className="p-3">Payment</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {ctl.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No invoices found.
                </td>
              </tr>
            )}
            {pageItems.map((o) => (
              <tr key={o.id} className="border-b border-[#222] last:border-0 hover:bg-white/5">
                <td className="p-3">
                  <Link href={`/admin/invoices/${o.id}`} className="font-medium text-indigo-400 hover:underline">
                    {o.invoice_number ?? o.order_number}
                  </Link>
                </td>
                <td className="p-3">{o.customer_name}</td>
                <td className="p-3">{formatDate(o.created_at)}</td>
                <td className="p-3">{o.order_items?.length ?? 0}</td>
                <td className="p-3">{formatCurrency(o.total_amount, currency)}</td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs capitalize ${
                      o.payment_status === "paid"
                        ? "bg-green-500/15 text-green-400"
                        : "bg-amber-500/15 text-amber-400"
                    }`}
                  >
                    {o.payment_status}
                  </span>
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
