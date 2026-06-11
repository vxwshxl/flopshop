"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pagination, usePagination } from "@/components/ui/pagination";
import toast from "react-hot-toast";
import { Select } from "@/components/ui/input";
import { setUserRoleAction, toggleUserActiveAction } from "@/app/admin/users/actions";
import { formatDate } from "@/lib/utils/formatters";
import { useTableControls, byText, byDate } from "@/lib/hooks/useTableControls";
import { TableToolbar, SortHeader } from "@/components/admin/TableControls";
import { TableScroll, tableCardClass, stickyHead } from "@/components/admin/TableShell";
import type { Profile, Role } from "@/lib/types";

const ROLES: Role[] = ["user", "delivery", "admin", "banned"];

export function UsersTable({
  users,
  orderCounts,
}: {
  users: Profile[];
  orderCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const ctl = useTableControls(users, {
    searchFields: (u) => [u.full_name, u.email, u.room_number],
    dateField: (u) => u.created_at,
    sorters: {
      name: byText((u) => u.full_name),
      orders: (a, b) => (orderCounts[a.id] ?? 0) - (orderCounts[b.id] ?? 0),
      joined: byDate((u) => u.created_at),
    },
    initialSort: "joined",
    initialDir: "desc",
  });
  const { page, setPage, perPage, setPerPage, total, totalPages, pageItems } = usePagination(ctl.rows);

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
        />
      </div>

      <TableScroll>
        <table className="w-full text-sm">
          <thead className={stickyHead}>
            <tr className="border-b border-black/10 text-left text-xs text-black/50 dark:border-white/10 dark:text-white/50">
              <SortHeader label="Name" sortKey="name" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} />
              <th className="p-3">Email</th>
              <th className="p-3">Room</th>
              <SortHeader label="Orders" sortKey="orders" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} defaultDir="desc" />
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
                <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="text-xs text-black underline decoration-yellow-400 underline-offset-4 dark:text-white"
                  >
                    View
                  </Link>
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
