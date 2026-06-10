import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { StatCard, PageHeader } from "@/components/admin/StatCard";
import { tablePageClass } from "@/components/admin/TableShell";
import { Truck, Users, Clock, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";
import type { Profile, Order, DeliverySettlement } from "@/lib/types";
import { AdminDeliveryRefresh } from "@/components/admin/AdminDeliveryRefresh";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { DeliveryPartnersTable, type DeliveryPartnerRow } from "@/components/admin/DeliveryPartnersTable";
import {
  DeliverySettlements,
  type PendingSettlement,
  type SettlementHistoryRow,
} from "@/components/admin/DeliverySettlements";

export const dynamic = "force-dynamic";

const FIVE_MIN = 5 * 60 * 1000;

export default async function AdminDeliveryPage() {
  const supabase = await createClient();
  const settings = await getSettings();
  const currency = settings.currency_symbol;
  const now = new Date();

  const [{ data: partners }, { data: ordersRaw }, { data: unsettledRaw }, { data: settlementsRaw }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, phone, room_number, hostel_block, is_online, last_active_at, created_at")
        .in("role", ["delivery", "admin"]),
      supabase
        .from("orders")
        .select("id, order_number, customer_name, delivery_person_id, status, delivery_person_earning, total_amount, updated_at")
        .eq("order_type", "delivery")
        .not("status", "in", "(cancelled)"),
      // Delivered, not-yet-settled delivery orders → drive the pending payouts.
      supabase
        .from("orders")
        .select("delivery_person_id, payment_method, total_amount, delivery_person_earning")
        .eq("order_type", "delivery")
        .eq("status", "delivered")
        .is("settlement_id", null),
      supabase
        .from("delivery_settlements")
        .select("id, delivery_person_id, order_count, net_amount, created_at, confirmed, confirmed_at")
        .order("created_at", { ascending: false })
        .limit(20),
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

  // ---- Settlements: pending payouts per partner + recent history ----
  const nameById = new Map(deliveryPartners.map((p) => [p.id, p.full_name ?? "Partner"]));

  const unsettled =
    (unsettledRaw as {
      delivery_person_id: string | null;
      payment_method: string;
      total_amount: number;
      delivery_person_earning: number;
    }[]) ?? [];

  const pendingMap = new Map<string, PendingSettlement>();
  for (const o of unsettled) {
    if (!o.delivery_person_id) continue;
    const e =
      pendingMap.get(o.delivery_person_id) ??
      {
        partnerId: o.delivery_person_id,
        name: nameById.get(o.delivery_person_id) ?? "Partner",
        orderCount: 0,
        cashToCollect: 0,
        upiPayout: 0,
        net: 0,
      };
    const total = Number(o.total_amount);
    const earning = Number(o.delivery_person_earning);
    e.orderCount += 1;
    if ((o.payment_method ?? "").toLowerCase() === "upi") e.upiPayout += earning;
    else e.cashToCollect += total - earning;
    e.net = e.cashToCollect - e.upiPayout;
    pendingMap.set(o.delivery_person_id, e);
  }
  const pendingSettlements = Array.from(pendingMap.values()).sort((a, b) => b.orderCount - a.orderCount);

  const settlementHistory: SettlementHistoryRow[] = (
    (settlementsRaw as DeliverySettlement[]) ?? []
  ).map((s) => ({
    id: s.id,
    name: nameById.get(s.delivery_person_id) ?? "Partner",
    order_count: s.order_count,
    net_amount: Number(s.net_amount),
    created_at: s.created_at,
    confirmed: s.confirmed,
    confirmed_at: s.confirmed_at,
  }));

  return (
    <div className={tablePageClass}>
      <AdminDeliveryRefresh />
      <RealtimeRefresh table="orders" channel="admin:delivery:orders" />
      <RealtimeRefresh table="profiles" channel="admin:delivery:profiles" />
      <RealtimeRefresh table="delivery_settlements" channel="admin:delivery:settlements" />
      <PageHeader title="Delivery Partners" />

      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
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

      <div className="glass mt-4 flex min-h-0 flex-1 flex-col rounded-2xl">
        <div className="glass-line flex shrink-0 items-center border-b px-4 py-3">
          <h3 className="text-sm font-bold text-stone-900 dark:text-white">Delivery Partners</h3>
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <DeliveryPartnersTable partners={partnerStats} currency={currency} />
        </div>
      </div>

      <DeliverySettlements pending={pendingSettlements} history={settlementHistory} currency={currency} />
    </div>
  );
}
