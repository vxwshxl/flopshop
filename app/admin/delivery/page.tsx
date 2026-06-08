import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { StatCard, AdminCard, PageHeader } from "@/components/admin/StatCard";
import { Truck, Users, Clock, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";
import type { Profile, Order } from "@/lib/types";
import { AdminDeliveryRefresh } from "@/components/admin/AdminDeliveryRefresh";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { DeliveryPartnersTable, type DeliveryPartnerRow } from "@/components/admin/DeliveryPartnersTable";

export const dynamic = "force-dynamic";

const FIVE_MIN = 5 * 60 * 1000;

export default async function AdminDeliveryPage() {
  const supabase = await createClient();
  const settings = await getSettings();
  const currency = settings.currency_symbol;
  const now = new Date();

  const [{ data: partners }, { data: ordersRaw }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, phone, room_number, hostel_block, is_online, last_active_at, created_at")
      .in("role", ["delivery", "admin"]),
    supabase
      .from("orders")
      .select("id, order_number, customer_name, delivery_person_id, status, delivery_person_earning, total_amount, updated_at")
      .eq("order_type", "delivery")
      .not("status", "in", "(cancelled)"),
  ]);

  const deliveryPartners = (partners as Profile[]) ?? [];
  const orders = (ordersRaw as Pick<Order, "id" | "order_number" | "customer_name" | "delivery_person_id" | "status" | "delivery_person_earning" | "total_amount" | "updated_at">[]) ?? [];

  const isActive = (p: typeof deliveryPartners[number]) =>
    p.is_online && p.last_active_at && now.getTime() - new Date(p.last_active_at).getTime() < FIVE_MIN;

  const activeCount = deliveryPartners.filter(isActive).length;
  const totalPartners = deliveryPartners.length;

  // Per-partner stats
  const partnerStats: DeliveryPartnerRow[] = deliveryPartners.map((p) => {
    const myOrders = orders.filter((o) => o.delivery_person_id === p.id);
    const delivered = myOrders.filter((o) => o.status === "delivered");
    const inProgress = myOrders.filter((o) => o.status === "out_for_delivery");
    const totalEarnings = delivered.reduce((s, o) => s + Number(o.delivery_person_earning), 0);

    // Sort recent deliveries desc
    const recentDeliveries = [...myOrders].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return {
      id: p.id,
      full_name: p.full_name,
      phone: p.phone,
      email: p.email,
      room_number: p.room_number,
      hostel_block: p.hostel_block,
      created_at: p.created_at,
      active: Boolean(isActive(p)),
      deliveredCount: delivered.length,
      inProgressCount: inProgress.length,
      totalEarnings,
      recentDeliveries,
    };
  });

  // Sort: active first, then by deliveredCount desc
  partnerStats.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return b.deliveredCount - a.deliveredCount;
  });

  const totalDelivered = orders.filter((o) => o.status === "delivered").length;
  const currentlyOut = orders.filter((o) => o.status === "out_for_delivery").length;
  const totalEarningsPaid = orders
    .filter((o) => o.status === "delivered")
    .reduce((s, o) => s + Number(o.delivery_person_earning), 0);

  return (
    <div>
      <AdminDeliveryRefresh />
      <RealtimeRefresh table="orders" channel="admin:delivery:orders" />
      <RealtimeRefresh table="profiles" channel="admin:delivery:profiles" />
      <PageHeader title="Delivery Partners" subtitle="Manage & monitor delivery team" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active Now"
          value={activeCount}
          icon={<Users className="h-4 w-4" />}
          hint={`${totalPartners} total partners`}
        />
        <StatCard
          label="Out for Delivery"
          value={currentlyOut}
          icon={<Truck className="h-4 w-4" />}
        />
        <StatCard
          label="Total Delivered"
          value={totalDelivered}
          icon={<CheckCircle className="h-4 w-4" />}
        />
        <StatCard
          label="Total Paid Out"
          value={formatCurrency(totalEarningsPaid, currency)}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      <AdminCard title="Delivery Partners" className="mt-4">
        <DeliveryPartnersTable partners={partnerStats} currency={currency} />
      </AdminCard>
    </div>
  );
}
