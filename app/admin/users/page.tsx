import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/StatCard";
import { tablePageClass } from "@/components/admin/TableShell";
import { UsersTable } from "@/components/admin/UsersTable";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const supabase = await createClient();

  const [{ data: users }, { data: orders }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("orders").select("user_id"),
  ]);

  const orderCounts: Record<string, number> = {};
  (orders ?? []).forEach((o: { user_id: string | null }) => {
    if (o.user_id) orderCounts[o.user_id] = (orderCounts[o.user_id] ?? 0) + 1;
  });

  return (
    <div className={tablePageClass}>
      <RealtimeRefresh table="profiles" channel="admin:profiles" />
      <PageHeader title="Users" subtitle={`${users?.length ?? 0} users`} />
      <UsersTable users={(users as Profile[]) ?? []} orderCounts={orderCounts} />
    </div>
  );
}
