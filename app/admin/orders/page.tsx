import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { getSettings } from "@/lib/supabase/queries";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import type { Order, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const supabase = await createClient();
  const settings = await getSettings();

  // OrdersTable searches, sorts and paginates client-side over the full set, so
  // it needs every order — not the newest 1000 PostgREST would cap us at, which
  // silently made older orders unreachable from this screen.
  const [orders, { data: people }] = await Promise.all([
    fetchAllRows<Order>((from, to) =>
      supabase
        .from("orders")
        .select(
          "*, order_items(id, product_id, product_name, quantity, unit_price, total_price), delivery_person:profiles!orders_delivery_person_id_fkey(id, full_name)"
        )
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to)
    ),
    supabase.from("profiles").select("id, full_name, role").in("role", ["delivery", "admin"]),
  ]);

  return (
    <>
      <RealtimeRefresh table="orders" channel="admin:orders" />
      <OrdersTable
        orders={orders}
        deliveryPeople={(people as Pick<Profile, "id" | "full_name" | "role">[]) ?? []}
        settings={settings}
      />
    </>
  );
}
