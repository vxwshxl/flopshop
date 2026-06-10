import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { PageHeader } from "@/components/admin/StatCard";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import type { Order, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const supabase = await createClient();
  const settings = await getSettings();

  const [{ data: orders }, { data: people }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, order_items(id, product_name), delivery_person:profiles!orders_delivery_person_id_fkey(id, full_name)")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, role").in("role", ["delivery", "admin"]),
  ]);

  return (
    <div>
      <RealtimeRefresh table="orders" channel="admin:orders" />
      <PageHeader title="Orders" subtitle={`${orders?.length ?? 0} total orders`} />
      <OrdersTable
        orders={(orders as Order[]) ?? []}
        deliveryPeople={(people as Pick<Profile, "id" | "full_name" | "role">[]) ?? []}
        currency={settings.currency_symbol}
      />
    </div>
  );
}
