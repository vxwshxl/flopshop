"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Pagination, usePagination } from "@/components/ui/pagination";
import toast from "react-hot-toast";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { setUserRoleAction, toggleUserActiveAction } from "@/app/admin/users/actions";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import type { Order, Profile, Role } from "@/lib/types";

const ROLES: Role[] = ["user", "delivery", "admin"];

export function UsersTable({
  users,
  orderCounts,
  currency,
}: {
  users: Profile[];
  orderCounts: Record<string, number>;
  currency: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<Profile | null>(null);
  const [history, setHistory] = useState<Order[] | null>(null);

  const filtered = useMemo(
    () =>
      users.filter(
        (u) =>
          (u.full_name ?? "").toLowerCase().includes(query.toLowerCase()) ||
          (u.email ?? "").toLowerCase().includes(query.toLowerCase())
      ),
    [users, query]
  );
  const { page, setPage, perPage, setPerPage, total, totalPages, pageItems } = usePagination(filtered);

  async function changeRole(u: Profile, role: Role) {
    setBusy(u.id);
    const res = await setUserRoleAction(u.id, role);
    setBusy(null);
    if (!res.ok) return toast.error(res.error ?? "Failed to update role.");
    toast.success(`${u.full_name ?? "User"} is now ${role}`);
    router.refresh();
  }

  async function toggleActive(u: Profile) {
    setBusy(u.id);
    const res = await toggleUserActiveAction(u.id, u.is_active ?? false);
    setBusy(null);
    if (!res.ok) return toast.error(res.error ?? "Failed to update status.");
    toast.success(u.is_active ? "User deactivated" : "User activated");
    router.refresh();
  }

  async function openHistory(u: Profile) {
    setHistoryFor(u);
    setHistory(null);
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", u.id)
      .order("created_at", { ascending: false });
    setHistory((data as Order[]) ?? []);
  }

  return (
    <div>
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email…"
          className="h-10 w-full rounded-lg border border-black/15 bg-white pl-9 pr-3 text-sm text-black placeholder:text-black/40 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 dark:border-white/15 dark:bg-black dark:text-white dark:placeholder:text-white/40"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-black">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs text-black/50 dark:border-white/10 dark:text-white/50">
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Room</th>
              <th className="p-3">Orders</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3">Joined</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-black/75 dark:text-white/75">
            {pageItems.map((u) => (
              <tr key={u.id} className="border-b border-black/10 last:border-0 hover:bg-yellow-400/10 dark:border-white/10">
                <td className="p-3 font-medium text-black dark:text-white">{u.full_name ?? "—"}</td>
                <td className="p-3 text-black/60 dark:text-white/60">{u.email}</td>
                <td className="p-3">{u.room_number ?? "—"}</td>
                <td className="p-3">{orderCounts[u.id] ?? 0}</td>
                <td className="p-3">
                  <Select
                    value={u.role}
                    disabled={busy === u.id}
                    onChange={(e) => changeRole(u, e.target.value as Role)}
                    className="min-w-28"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="p-3">
                  <button
                    onClick={() => toggleActive(u)}
                    disabled={busy === u.id}
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      u.is_active
                        ? "border border-yellow-400 bg-yellow-400 text-black"
                        : "border border-black/15 text-black/50 dark:border-white/15 dark:text-white/50"
                    }`}
                  >
                    {u.is_active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="p-3 text-xs text-black/50 dark:text-white/50">{formatDate(u.created_at)}</td>
                <td className="p-3 text-right">
                  <button onClick={() => openHistory(u)} className="text-xs text-black underline decoration-yellow-400 underline-offset-4 dark:text-white">
                    View orders
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} perPage={perPage} total={total} onPage={setPage} onPerPage={setPerPage} />

      <Modal open={!!historyFor} onClose={() => setHistoryFor(null)} title={`${historyFor?.full_name ?? "User"} — Orders`}>
        {history === null ? (
          <p className="py-6 text-center text-sm text-black/50 dark:text-white/50">Loading...</p>
        ) : history.length === 0 ? (
          <p className="py-6 text-center text-sm text-black/50 dark:text-white/50">No orders.</p>
        ) : (
          <PaginatedOrders orders={history} currency={currency} />
        )}
      </Modal>
    </div>
  );
}

function PaginatedOrders({ orders, currency }: { orders: Order[]; currency: string }) {
  const { page, setPage, perPage, setPerPage, total, totalPages, pageItems } = usePagination(orders, 5);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {pageItems.map((o) => (
          <Link
            key={o.id}
            href={`/admin/orders/${o.id}`}
            className="flex items-center justify-between rounded-lg border border-black/10 p-2.5 text-sm transition hover:border-yellow-400 hover:bg-yellow-400/10 dark:border-white/10"
          >
            <div>
              <p className="font-medium text-black dark:text-white">{o.order_number}</p>
              <p className="text-xs text-black/50 dark:text-white/50">
                {formatDate(o.created_at)} · {o.status}
              </p>
            </div>
            <span className="font-semibold text-black dark:text-white">{formatCurrency(o.total_amount, currency)}</span>
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
