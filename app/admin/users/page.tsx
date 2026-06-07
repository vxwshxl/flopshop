import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { PageHeader } from "@/components/admin/StatCard";
import { UsersTable } from "@/components/admin/UsersTable";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const supabase = await createClient();
  const settings = await getSettings();

  const [{ data: users }, { data: orders }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("orders").select("user_id"),
  ]);

  const orderCounts: Record<string, number> = {};
  (orders ?? []).forEach((o: { user_id: string | null }) => {
    if (o.user_id) orderCounts[o.user_id] = (orderCounts[o.user_id] ?? 0) + 1;
  });

  return (
    <div>
      <PageHeader title="Users" subtitle={`${users?.length ?? 0} users`} />
      <UsersTable
        users={(users as Profile[]) ?? []}
        orderCounts={orderCounts}
        currency={settings.currency_symbol}
      />
    </div>
  );
}
