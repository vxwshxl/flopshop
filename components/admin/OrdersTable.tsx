"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Printer, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  setOrderStatusAction,
  assignDeliveryAction,
  setPaymentStatusAction,
  deleteOrderAction,
} from "@/app/admin/orders/actions";
import { OrderStatusBadge } from "@/components/store/OrderStatusBadge";
import { Invoice } from "@/components/Invoice";
import { PrintPortal } from "@/components/PrintPortal";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { PageHeader } from "@/components/admin/StatCard";
import { TableToolbar, SortHeader } from "@/components/admin/TableControls";
import { TableScroll, tablePageClass, tableCardClass, stickyHead } from "@/components/admin/TableShell";
import { useTableControls, byText, byNum, byDate } from "@/lib/hooks/useTableControls";
import { formatCurrency, formatDateTime, formatPaymentMethod, paymentMethodLabel } from "@/lib/utils/formatters";
import { ORDER_STATUSES, STATUS_LABELS, adminSettableStatuses, statusLabel } from "@/lib/utils/orderHelpers";
import type { Order, OrderItem, OrderStatus, PaymentStatus, Profile, SettingsMap } from "@/lib/types";

type Row = Order & {
  order_items?: OrderItem[];
  delivery_person?: Pick<Profile, "id" | "full_name"> | null;
};

const TABS: ("all" | OrderStatus)[] = ["all", ...ORDER_STATUSES];

type PayFilter = "all" | "cash" | "upi" | "split" | "bank" | "other" | "paid" | "unpaid";
const PAY_FILTERS: { key: PayFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "cash", label: "Cash" },
  { key: "upi", label: "UPI" },
  { key: "split", label: "Split" },
  { key: "bank", label: "Bank Transfer" },
  { key: "other", label: "Other" },
  { key: "paid", label: "Paid" },
  { key: "unpaid", label: "Unpaid" },
];

// Normalised payment method so imported rows ("Cash", "Bank Transfer") match
// app-created ones ("cash", "bank transfer").
const payMethod = (o: { payment_method: string }) =>
  (o.payment_method ?? "").trim().toLowerCase();
const KNOWN_METHODS = ["cash", "upi", "split", "bank transfer"];

// Predicate per filter chip. Cash/UPI/Split/Bank/Other key off the payment
// method; Paid/Unpaid key off the payment status (Unpaid = still pending).
const PAY_MATCHERS: Record<Exclude<PayFilter, "all">, (o: Row) => boolean> = {
  cash: (o) => payMethod(o) === "cash",
  upi: (o) => payMethod(o) === "upi",
  split: (o) => payMethod(o) === "split",
  bank: (o) => payMethod(o) === "bank transfer",
  other: (o) => !KNOWN_METHODS.includes(payMethod(o)),
  paid: (o) => o.payment_status === "paid",
  unpaid: (o) => o.payment_status === "pending",
};

export function OrdersTable({
  orders,
  deliveryPeople,
  settings,
}: {
  orders: Row[];
  deliveryPeople: Pick<Profile, "id" | "full_name" | "role">[];
  settings: SettingsMap;
}) {
  const currency = settings.currency_symbol ?? "₹";
  const [tab, setTab] = useState<"all" | OrderStatus>("all");
  const [payFilter, setPayFilter] = useState<PayFilter>("all");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  // Optimistic status per row so the table reflects the change immediately
  // (and survives a flaky revalidation) until fresh server data arrives.
  const [overrides, setOverrides] = useState<Record<string, OrderStatus>>({});
  const statusOf = (o: Row) => overrides[o.id] ?? o.status;
  // Optimistic payment status (same idea) so "Mark paid" reflects instantly.
  const [payStatusOverrides, setPayStatusOverrides] = useState<Record<string, PaymentStatus>>({});
  const payStatusOf = (o: Row) => payStatusOverrides[o.id] ?? o.payment_status;
  // Invoice-preview modal target + delete-confirm target.
  const [invoiceTarget, setInvoiceTarget] = useState<Row | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Cancel-with-reason target (so a reason can be captured from the list itself).
  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  function markPaid(id: string) {
    setPayStatusOverrides((m) => ({ ...m, [id]: "paid" }));
    startTransition(async () => {
      try {
        const res = await setPaymentStatusAction(id, "paid");
        if (!res.ok) {
          setPayStatusOverrides((m) => {
            const n = { ...m };
            delete n[id];
            return n;
          });
          toast.error(res.error ?? "Failed");
          return;
        }
        toast.success("Marked paid");
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteOrderAction(deleteTarget.id);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to delete");
        return;
      }
      toast.success("Order deleted");
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    ORDER_STATUSES.forEach((s) => (c[s] = orders.filter((o) => o.status === s).length));
    return c;
  }, [orders]);

  const payCounts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    PAY_FILTERS.forEach(({ key }) => {
      if (key !== "all") c[key] = orders.filter(PAY_MATCHERS[key]).length;
    });
    return c;
  }, [orders]);

  const tabbed = useMemo(() => {
    const byStatus = tab === "all" ? orders : orders.filter((o) => o.status === tab);
    return payFilter === "all" ? byStatus : byStatus.filter(PAY_MATCHERS[payFilter]);
  }, [orders, tab, payFilter]);
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

  // Revenue of the currently-filtered rows (status + payment + search + date).
  const filteredRevenue = useMemo(
    () => ctl.rows.reduce((s, o) => s + Number(o.total_amount), 0),
    [ctl.rows]
  );

  function changeStatus(id: string, status: OrderStatus) {
    // Cancelling needs a reason — capture it in a popup right from the list.
    if (status === "cancelled") {
      const row = orders.find((o) => o.id === id) ?? null;
      setCancelReason("");
      setCancelTarget(row);
      return;
    }
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

  function confirmCancel() {
    const target = cancelTarget;
    if (!target) return;
    if (!cancelReason.trim()) {
      toast.error("Please provide a cancellation reason.");
      return;
    }
    startTransition(async () => {
      const res = await setOrderStatusAction(target.id, "cancelled", undefined, cancelReason.trim());
      if (!res.ok) {
        toast.error(res.error ?? "Failed");
        return;
      }
      setOverrides((m) => ({ ...m, [target.id]: "cancelled" }));
      toast.success("Order cancelled");
      setCancelTarget(null);
      setCancelReason("");
      router.refresh();
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
    <div className={tablePageClass}>
      <PageHeader
        title="Orders"
        subtitle={<span className="hidden lg:inline">{orders.length} total orders</span>}
        action={
          // Compact search sits beside the title on mobile/tablet to save vertical space.
          <div className="relative w-44 sm:w-64 lg:hidden">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              value={ctl.query}
              onChange={(e) => ctl.setQuery(e.target.value)}
              placeholder="Search…"
              className="h-10 w-full rounded-lg border border-[#333] bg-[#1a1a1a] pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        }
      />

      <div className={tableCardClass}>
        <div className="mb-4 flex shrink-0 flex-wrap items-center justify-center gap-2 lg:justify-start">
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

      <div className="mb-4 flex shrink-0 flex-wrap items-center justify-center gap-2 lg:justify-between">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {PAY_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPayFilter(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                payFilter === key
                  ? "bg-emerald-500 text-white"
                  : "border border-black/10 bg-white text-black/60 hover:text-black dark:border-white/10 dark:bg-black dark:text-white/60 dark:hover:text-white"
              }`}
            >
              {label} <span className="opacity-60">({payCounts[key] ?? 0})</span>
            </button>
          ))}
        </div>
        <div className="text-sm text-black/60 dark:text-white/60">
          Revenue:{" "}
          <span className="font-semibold text-black dark:text-white">
            {formatCurrency(filteredRevenue, currency)}
          </span>
        </div>
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
          searchHiddenOnMobile
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
              <th className="p-3">Payment</th>
              <th className="p-3">Status</th>
              <SortHeader label="Date" sortKey="date" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} defaultDir="desc" />
              <th className="p-3">Update</th>
              <th className="p-3">Delivery</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="text-black/75 dark:text-white/75">
            {ctl.rows.length === 0 && (
              <tr>
                <td colSpan={11} className="p-8 text-center text-black/50 dark:text-white/50">
                  No orders.
                </td>
              </tr>
            )}
            {pageItems.map((o) => (
              <tr
                key={o.id}
                onClick={() => router.push(`/admin/orders/${o.id}`)}
                className="cursor-pointer border-b border-black/10 last:border-0 hover:bg-yellow-400/10 dark:border-white/10"
              >
                <td className="p-3">
                  <span className="font-medium text-black underline decoration-yellow-400 underline-offset-4 dark:text-white">
                    {o.order_number}
                  </span>
                </td>
                <td className="p-3">
                  {o.customer_name}
                  {o.is_manual && <span className="ml-1 text-[10px] text-black/50 dark:text-white/50">(walk-in)</span>}
                </td>
                <td className="p-3 capitalize">{o.order_type}</td>
                <td className="p-3">{o.order_items?.length ?? 0}</td>
                <td className="p-3">{formatCurrency(o.total_amount, currency)}</td>
                <td className="p-3 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <span title={formatPaymentMethod(o, currency)}>{paymentMethodLabel(o.payment_method)}</span>
                    <span
                      className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        payStatusOf(o) === "paid"
                          ? "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/15 dark:text-emerald-200"
                          : "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/15 dark:text-amber-200"
                      }`}
                    >
                      {payStatusOf(o) === "paid"
                        ? "Paid"
                        : payStatusOf(o) === "partial"
                          ? `Partial · ${formatCurrency(Math.max(Number(o.total_amount) - Number(o.amount_paid ?? 0), 0), currency)} left`
                          : "Unpaid"}
                    </span>
                  </div>
                </td>
                <td className="p-3">
                  <OrderStatusBadge status={statusOf(o)} />
                </td>
                <td className="p-3 whitespace-nowrap text-xs text-black/50 dark:text-white/50">{formatDateTime(o.created_at)}</td>
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
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
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
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
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    {payStatusOf(o) !== "paid" && (
                      <button
                        onClick={() => markPaid(o.id)}
                        disabled={pending}
                        className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
                      >
                        Mark paid
                      </button>
                    )}
                    <button
                      onClick={() => setInvoiceTarget(o)}
                      disabled={pending}
                      title="View invoice"
                      className="grid h-7 w-7 place-items-center rounded-md border border-black/10 text-black/60 transition hover:bg-black/5 hover:text-black disabled:opacity-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(o)}
                      disabled={pending}
                      title="Delete order"
                      className="grid h-7 w-7 place-items-center rounded-md border border-black/10 text-red-500 transition hover:bg-red-500/10 disabled:opacity-50 dark:border-white/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
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

      <Modal
        open={!!invoiceTarget}
        onClose={() => setInvoiceTarget(null)}
        title={`Invoice · ${invoiceTarget?.order_number ?? ""}`}
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

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete order?">
        <p className="mb-4 text-sm text-gray-300">
          This permanently deletes order{" "}
          <span className="font-semibold text-white">{deleteTarget?.order_number}</span> and its items.
          Any stock it was holding is returned to inventory. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete} disabled={deleting} loading={deleting}>
            Delete order
          </Button>
        </div>
      </Modal>

      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="Cancel order">
        <p className="mb-3 text-sm text-gray-300">
          Cancelling order <span className="font-semibold text-white">{cancelTarget?.order_number}</span> returns its
          stock to inventory. Tell the customer why — this reason is saved with the order.
        </p>
        <Input
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="e.g. item out of stock"
          className="mb-4 w-full"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={pending}>
            Back
          </Button>
          <Button variant="danger" onClick={confirmCancel} disabled={pending || !cancelReason.trim()} loading={pending}>
            Cancel order
          </Button>
        </div>
      </Modal>
    </div>
  );
}
