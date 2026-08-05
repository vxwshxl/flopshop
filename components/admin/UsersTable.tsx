"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wallet as WalletIcon } from "lucide-react";
import { Pagination, usePagination } from "@/components/ui/pagination";
import toast from "react-hot-toast";
import { Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { setUserRoleAction, toggleUserActiveAction } from "@/app/admin/users/actions";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { useTableControls, byText, byDate } from "@/lib/hooks/useTableControls";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { TableToolbar, SortHeader } from "@/components/admin/TableControls";
import { TableScroll, tableCardClass, stickyHead } from "@/components/admin/TableShell";
import { WalletPanel } from "@/components/admin/WalletPanel";
import type { Profile, Role } from "@/lib/types";

const ROLES: Role[] = ["user", "delivery", "admin", "banned"];

export function UsersTable({
  users,
  orderCounts,
  balances = {},
}: {
  users: Profile[];
  orderCounts: Record<string, number>;
  /** Store-credit balance per profile id — drives the Credit column. */
  balances?: Record<string, number>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  // User whose store-credit wallet is open for adjustment.
  const [creditUser, setCreditUser] = useState<Profile | null>(null);
  // Store-credit filter: all / credit (balance > 0) / debt (< 0) / settled (= 0).
  const [balanceFilter, setBalanceFilter] = usePersistentState<"all" | "credit" | "debt" | "settled">(
    "admin:users:balance",
    "all"
  );

  const byBalance =
    balanceFilter === "all"
      ? users
      : users.filter((u) => {
          const bal = balances[u.id] ?? 0;
          if (balanceFilter === "credit") return bal > 0;
          if (balanceFilter === "debt") return bal < 0;
          return bal === 0; // settled
        });

  const ctl = useTableControls(byBalance, {
    searchFields: (u) => [u.full_name, u.email, u.room_number],
    dateField: (u) => u.created_at,
    sorters: {
      name: byText((u) => u.full_name),
      orders: (a, b) => (orderCounts[a.id] ?? 0) - (orderCounts[b.id] ?? 0),
      credit: (a, b) => (balances[a.id] ?? 0) - (balances[b.id] ?? 0),
      joined: byDate((u) => u.created_at),
    },
    initialSort: "joined",
    initialDir: "desc",
    persistKey: "admin:users:ctl",
  });
  const { page, setPage, perPage, setPerPage, total, totalPages, pageItems } = usePagination(
    ctl.rows,
    20,
    "admin:users:pg"
  );

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

  return (
    <div className={tableCardClass}>
      <div className="shrink-0">
        <TableToolbar
          query={ctl.query}
          onQuery={ctl.setQuery}
          placeholder="Search name, email or room…"
          from={ctl.from}
          to={ctl.to}
          onFrom={ctl.setFrom}
          onTo={ctl.setTo}
          hasDateFilter={ctl.hasDateFilter}
          onClearDates={ctl.clearDates}
        >
          <Select
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value as typeof balanceFilter)}
            className="w-40 lg:w-44"
          >
            <option value="all">All balances</option>
            <option value="credit">Has credit</option>
            <option value="debt">Has debt</option>
            <option value="settled">Settled (₹0)</option>
          </Select>
        </TableToolbar>
      </div>

      <TableScroll>
        <table className="w-full min-w-[52rem] text-sm">
          <thead className={stickyHead}>
            <tr className="border-b border-black/10 text-left text-xs text-black/50 dark:border-white/10 dark:text-white/50">
              <SortHeader label="Name" sortKey="name" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} />
              <th className="p-3">Email</th>
              <th className="p-3">Room</th>
              <SortHeader label="Orders" sortKey="orders" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} defaultDir="desc" />
              <SortHeader label="Credit" sortKey="credit" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} defaultDir="desc" className="text-right" />
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <SortHeader label="Joined" sortKey="joined" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} defaultDir="desc" />
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-black/75 dark:text-white/75">
            {pageItems.map((u) => (
              <tr
                key={u.id}
                onClick={() => router.push(`/admin/users/${u.id}`)}
                className="cursor-pointer border-b border-black/10 last:border-0 hover:bg-yellow-400/10 dark:border-white/10"
              >
                <td className="p-3 font-medium text-black dark:text-white">{u.full_name ?? "—"}</td>
                <td className="p-3 text-black/60 dark:text-white/60">{u.email}</td>
                <td className="p-3">{u.room_number ?? "—"}</td>
                <td className="p-3">{orderCounts[u.id] ?? 0}</td>
                <td className="p-3 text-right font-medium">
                  {balances[u.id] ? (
                    <span
                      className={
                        balances[u.id] < 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-lime-600 dark:text-lime-400"
                      }
                    >
                      {formatCurrency(balances[u.id], "₹")}
                    </span>
                  ) : (
                    <span className="text-black/30 dark:text-white/30">—</span>
                  )}
                </td>
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
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
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
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
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setCreditUser(u)}
                      className="rounded-md p-1.5 text-black/50 hover:bg-yellow-400 hover:text-black dark:text-white/50"
                      aria-label={`Store credit for ${u.full_name ?? "user"}`}
                      title="Store credit"
                    >
                      <WalletIcon className="h-4 w-4" />
                    </button>
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="text-xs text-black underline decoration-yellow-400 underline-offset-4 dark:text-white"
                    >
                      View
                    </Link>
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

      <Modal
        open={!!creditUser}
        onClose={() => setCreditUser(null)}
        title={creditUser ? `Store credit — ${creditUser.full_name ?? creditUser.email}` : "Store credit"}
      >
        {creditUser && (
          <WalletPanel
            owner={{ profileId: creditUser.id }}
            initialBalance={balances[creditUser.id] ?? 0}
            currency="₹"
          />
        )}
      </Modal>
    </div>
  );
}
