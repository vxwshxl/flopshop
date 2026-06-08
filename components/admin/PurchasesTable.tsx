"use client";

import { Pagination, usePagination } from "@/components/ui/pagination";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import type { Purchase } from "@/lib/types";

export function PurchasesTable({ purchases, currency }: { purchases: Purchase[]; currency: string }) {
  const { page, setPage, perPage, setPerPage, total, totalPages, pageItems } = usePagination(purchases);

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-[#222] bg-[#1a1a1a]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#222] text-left text-xs text-gray-500">
              <th className="p-3">Date</th>
              <th className="p-3">Product</th>
              <th className="p-3">Qty</th>
              <th className="p-3">Unit Price</th>
              <th className="p-3">Total</th>
              <th className="p-3">Supplier</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {purchases.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No purchases recorded yet.
                </td>
              </tr>
            )}
            {pageItems.map((p) => (
              <tr key={p.id} className="border-b border-[#222] last:border-0 hover:bg-white/5">
                <td className="p-3">{formatDate(p.purchase_date)}</td>
                <td className="p-3 font-medium text-white">{p.product_name}</td>
                <td className="p-3">{p.quantity}</td>
                <td className="p-3">{formatCurrency(p.unit_price, currency)}</td>
                <td className="p-3">{formatCurrency(p.total_cost, currency)}</td>
                <td className="p-3">{p.supplier ?? "—"}</td>
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
      />
    </div>
  );
}
