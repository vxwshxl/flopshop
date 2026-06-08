"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import type { Order } from "@/lib/types";

type Row = Order & { order_items?: { id: string }[] };

export function InvoicesList({ orders, currency }: { orders: Row[]; currency: string }) {
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");

  const filtered = useMemo(
    () =>
      orders.filter((o) => {
        const matchQ =
          (o.invoice_number ?? "").toLowerCase().includes(query.toLowerCase()) ||
          o.customer_name.toLowerCase().includes(query.toLowerCase()) ||
          o.order_number.toLowerCase().includes(query.toLowerCase());
        const matchD = !date || o.created_at.slice(0, 10) === date;
        return matchQ && matchD;
      }),
    [orders, query, date]
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search invoice # or customer…"
            className="h-10 w-full rounded-lg border border-[#333] bg-[#1a1a1a] pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <DatePicker value={date} onChange={setDate} className="w-44" placeholder="Filter by date" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#222] bg-[#1a1a1a]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#222] text-left text-xs text-gray-500">
              <th className="p-3">Invoice #</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Date</th>
              <th className="p-3">Items</th>
              <th className="p-3">Total</th>
              <th className="p-3">Payment</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No invoices found.
                </td>
              </tr>
            )}
            {filtered.map((o) => (
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
      </div>
    </div>
  );
}
