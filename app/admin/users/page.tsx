import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { PageHeader } from "@/components/admin/StatCard";
import { tablePageClass } from "@/components/admin/TableShell";
import { UsersTable } from "@/components/admin/UsersTable";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const supabase = await createClient();

  const [{ data: users }, orders, { data: walletRows }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    // Per-user order counts are tallied from every order, not the first 1000.
    fetchAllRows<{ user_id: string | null }>((from, to) =>
      supabase.from("orders").select("user_id").order("id").range(from, to)
    ),
    // Store-credit balances keyed by profile id (for the Credit column), same as
    // the customers directory does for walk-ins.
    supabase.from("wallets").select("profile_id, balance").not("profile_id", "is", null),
  ]);

  const orderCounts: Record<string, number> = {};
  orders.forEach((o) => {
    if (o.user_id) orderCounts[o.user_id] = (orderCounts[o.user_id] ?? 0) + 1;
  });

  const balances: Record<string, number> = {};
  for (const w of (walletRows as { profile_id: string; balance: number }[] | null) ?? []) {
    balances[w.profile_id] = Number(w.balance);
  }

  return (
    <div className={tablePageClass}>
      <RealtimeRefresh table="profiles" channel="admin:profiles" />
      <PageHeader title="Users" subtitle={`${users?.length ?? 0} users`} />
      <UsersTable users={(users as Profile[]) ?? []} orderCounts={orderCounts} balances={balances} />
    </div>
  );
}
