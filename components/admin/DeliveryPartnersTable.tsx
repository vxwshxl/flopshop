"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import { Modal } from "@/components/ui/modal";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { TableToolbar, SortHeader } from "@/components/admin/TableControls";
import { useTableControls, byText, byNum } from "@/lib/hooks/useTableControls";
import { OrderStatusBadge } from "@/components/store/OrderStatusBadge";
import type { OrderStatus } from "@/lib/types";

export type DeliveryPartnerRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  room_number: string | null;
  hostel_block: string | null;
  created_at: string;
  active: boolean;
  deliveredCount: number;
  inProgressCount: number;
  totalEarnings: number;
  recentDeliveries: {
    id: string;
    order_number: string;
    customer_name: string;
    status: OrderStatus;
    updated_at: string;
    delivery_person_earning: number;
  }[];
};

export function DeliveryPartnersTable({
  partners,
  currency,
}: {
  partners: DeliveryPartnerRow[];
  currency: string;
}) {
  const [selected, setSelected] = useState<DeliveryPartnerRow | null>(null);
  const ctl = useTableControls(partners, {
    searchFields: (p) => [p.full_name, p.phone, p.email],
    sorters: {
      name: byText((p) => p.full_name),
      progress: byNum((p) => p.inProgressCount),
      delivered: byNum((p) => p.deliveredCount),
      earnings: byNum((p) => p.totalEarnings),
    },
    initialSort: "name",
    initialDir: "asc",
  });
  const { pageItems } = usePagination(ctl.rows);

  if (partners.length === 0) {
    return <p className="py-8 text-center text-sm text-stone-500">No delivery partners yet.</p>;
  }

  return (
    <>
      <TableToolbar query={ctl.query} onQuery={ctl.setQuery} placeholder="Search partner…" showDateRange={false} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-stone-500">
              <SortHeader label="Partner" sortKey="name" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} className="!p-0 !pb-2" />
              <th className="pb-2">Status</th>
              <SortHeader label="In Progress" sortKey="progress" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} className="!p-0 !pb-2 text-center" defaultDir="desc" />
              <SortHeader label="Delivered" sortKey="delivered" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} className="!p-0 !pb-2 text-center" defaultDir="desc" />
              <SortHeader label="Earnings" sortKey="earnings" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} className="!p-0 !pb-2 text-right" defaultDir="desc" />
            </tr>
          </thead>
          <tbody className="text-stone-300">
            {pageItems.map((p) => (
              <tr
                key={p.id}
                className="cursor-pointer border-t border-white/10 transition-colors hover:bg-white/5"
                onClick={() => setSelected(p)}
              >
                <td className="py-3">
                  <div>
                    <p className="font-semibold text-white">{p.full_name ?? "—"}</p>
                    {p.phone && <p className="text-xs text-stone-500">{p.phone}</p>}
                  </div>
                </td>
                <td className="py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: p.active ? "#f5c518" : "#555" }}
                    />
                    {p.active ? "Online" : "Offline"}
                  </span>
                </td>
                <td className="py-3 text-center">
                  {p.inProgressCount > 0 ? (
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-lime-400/15 px-2 text-xs font-bold text-lime-300">
                      {p.inProgressCount}
                    </span>
                  ) : (
                    <span className="text-stone-600">0</span>
                  )}
                </td>
                <td className="py-3 text-center text-white">{p.deliveredCount}</td>
                <td className="py-3 text-right font-semibold text-lime-400">
                  {formatCurrency(p.totalEarnings, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.full_name ?? "Partner Details"}
        className="max-w-xl"
      >
        {selected && (
          <div>
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
              <div>
                <p className="text-xs text-stone-500">Email</p>
                <p className="font-medium text-white">{selected.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-stone-500">Phone</p>
                <p className="font-medium text-white">{selected.phone ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-stone-500">Hostel & Room</p>
                <p className="font-medium text-white">
                  {selected.hostel_block ? `${selected.hostel_block} ` : ""}
                  {selected.room_number ? `Rm ${selected.room_number}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-stone-500">Joined</p>
                <p className="font-medium text-white">{formatDateTime(selected.created_at)}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-stone-500">Lifetime Deliveries</p>
                <p className="mt-1 text-xl font-extrabold text-white">{selected.deliveredCount}</p>
              </div>
              <div className="rounded-xl border border-lime-400/20 bg-lime-400/5 p-4">
                <p className="text-xs text-lime-500">Total Earnings</p>
                <p className="mt-1 text-xl font-extrabold text-lime-400">
                  {formatCurrency(selected.totalEarnings, currency)}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="mb-3 font-semibold text-stone-300">Recent Deliveries</h4>
              {selected.recentDeliveries.length === 0 ? (
                <p className="text-sm text-stone-500">No deliveries yet.</p>
              ) : (
                <PaginatedDeliveries deliveries={selected.recentDeliveries} currency={currency} />
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function PaginatedDeliveries({
  deliveries,
  currency,
}: {
  deliveries: DeliveryPartnerRow["recentDeliveries"];
  currency: string;
}) {
  const { page, setPage, perPage, setPerPage, total, totalPages, pageItems } = usePagination(deliveries, 5);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {pageItems.map((o) => (
          <Link
            key={o.id}
            href={`/admin/orders/${o.id}`}
            className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3 text-sm transition hover:border-lime-400 hover:bg-lime-400/10"
          >
            <div>
              <p className="font-semibold text-white">{o.order_number}</p>
              <p className="text-xs text-stone-400">
                {o.customer_name} • {formatDateTime(o.updated_at)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-lime-400">
                +{formatCurrency(o.delivery_person_earning, currency)}
              </span>
              <OrderStatusBadge status={o.status} />
            </div>
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
        pageSizes={[5, 10, 20]}
      />
    </div>
  );
}
