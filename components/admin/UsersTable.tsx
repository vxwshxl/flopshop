"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
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

  async function changeRole(u: Profile, role: Role) {
    setBusy(u.id);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ role }).eq("id", u.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`${u.full_name ?? "User"} is now ${role}`);
    router.refresh();
  }

  async function toggleActive(u: Profile) {
    setBusy(u.id);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ is_active: !u.is_active }).eq("id", u.id);
    setBusy(null);
    if (error) return toast.error(error.message);
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
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email…"
          className="h-10 w-full rounded-lg border border-[#333] bg-[#1a1a1a] pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#222] bg-[#1a1a1a]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#222] text-left text-xs text-gray-500">
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
          <tbody className="text-gray-300">
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-[#222] last:border-0 hover:bg-white/5">
                <td className="p-3 font-medium text-white">{u.full_name ?? "—"}</td>
                <td className="p-3 text-gray-400">{u.email}</td>
                <td className="p-3">{u.room_number ?? "—"}</td>
                <td className="p-3">{orderCounts[u.id] ?? 0}</td>
                <td className="p-3">
                  <select
                    value={u.role}
                    disabled={busy === u.id}
                    onChange={(e) => changeRole(u, e.target.value as Role)}
                    className="rounded-md border border-[#333] bg-[#0a0a0a] px-2 py-1 text-xs capitalize text-white focus:outline-none"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <button
                    onClick={() => toggleActive(u)}
                    disabled={busy === u.id}
                    className={`rounded-full px-2 py-0.5 text-xs ${u.is_active ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}
                  >
                    {u.is_active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="p-3 text-xs text-gray-500">{formatDate(u.created_at)}</td>
                <td className="p-3 text-right">
                  <button onClick={() => openHistory(u)} className="text-xs text-indigo-400 hover:underline">
                    View orders
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!historyFor} onClose={() => setHistoryFor(null)} title={`${historyFor?.full_name ?? "User"} — Orders`}>
        {history === null ? (
          <p className="py-6 text-center text-sm text-gray-400">Loading…</p>
        ) : history.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No orders.</p>
        ) : (
          <div className="space-y-2">
            {history.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-2.5 text-sm">
                <div>
                  <p className="font-medium text-gray-900">{o.order_number}</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(o.created_at)} · {o.status}
                  </p>
                </div>
                <span className="font-semibold text-gray-900">{formatCurrency(o.total_amount, currency)}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
