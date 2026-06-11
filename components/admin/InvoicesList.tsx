"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Printer } from "lucide-react";
import { Invoice } from "@/components/Invoice";
import { PrintPortal } from "@/components/PrintPortal";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { TableToolbar, SortHeader } from "@/components/admin/TableControls";
import { TableScroll, tableCardClass } from "@/components/admin/TableShell";
import { useTableControls, byText, byNum, byDate } from "@/lib/hooks/useTableControls";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import type { Order, OrderItem, SettingsMap } from "@/lib/types";

type Row = Order & { order_items?: OrderItem[] };

export function InvoicesList({ orders, settings }: { orders: Row[]; settings: SettingsMap }) {
  const router = useRouter();
  const currency = settings.currency_symbol ?? "₹";
  // Invoice-preview modal target.
  const [invoiceTarget, setInvoiceTarget] = useState<Row | null>(null);

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
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {ctl.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  No invoices found.
                </td>
              </tr>
            )}
            {pageItems.map((o) => (
              <tr
                key={o.id}
                onClick={() => router.push(`/admin/invoices/${o.id}`)}
                className="cursor-pointer border-b border-[#222] last:border-0 hover:bg-white/5"
              >
                <td className="p-3">
                  <span className="font-medium text-indigo-400">{o.invoice_number ?? o.order_number}</span>
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
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setInvoiceTarget(o)}
                    title="View invoice"
                    className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-white/60 transition hover:bg-white/10 hover:text-white"
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <div className="shrink-0">
        <Pagination page={page} totalPages={totalPages} perPage={perPage} total={total} onPage={setPage} onPerPage={setPerPage} />
      </div>

      <Modal
        open={!!invoiceTarget}
        onClose={() => setInvoiceTarget(null)}
        title={`Invoice · ${invoiceTarget?.invoice_number ?? invoiceTarget?.order_number ?? ""}`}
      >
        {invoiceTarget && (
          <>
            <div className="rounded-lg bg-white p-4">
              <Invoice order={invoiceTarget} settings={settings} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setInvoiceTarget(null)}>
                Close
              </Button>
              <Button variant="dark" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Dedicated print source — only this renders when the dialog's Print is used. */}
      {invoiceTarget && (
        <PrintPortal>
          <Invoice order={invoiceTarget} settings={settings} />
        </PrintPortal>
      )}
    </div>
  );
}
