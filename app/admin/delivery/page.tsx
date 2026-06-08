import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { StatCard, AdminCard, PageHeader } from "@/components/admin/StatCard";
import { Truck, Users, Clock, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";
import type { Profile, Order } from "@/lib/types";
import { AdminDeliveryRefresh } from "@/components/admin/AdminDeliveryRefresh";

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
      .select("id, full_name, phone, is_online, last_active_at")
      .eq("role", "delivery"),
    supabase
      .from("orders")
      .select("id, delivery_person_id, status, delivery_person_earning, total_amount, updated_at")
      .eq("order_type", "delivery")
      .not("status", "in", "(cancelled)"),
  ]);

  const deliveryPartners = (partners as Pick<Profile, "id" | "full_name" | "phone" | "is_online" | "last_active_at">[]) ?? [];
  const orders = (ordersRaw as Pick<Order, "id" | "delivery_person_id" | "status" | "delivery_person_earning" | "total_amount" | "updated_at">[]) ?? [];

  const isActive = (p: typeof deliveryPartners[number]) =>
    p.is_online && p.last_active_at && now.getTime() - new Date(p.last_active_at).getTime() < FIVE_MIN;

  const activeCount = deliveryPartners.filter(isActive).length;
  const totalPartners = deliveryPartners.length;

  // Per-partner stats
  const partnerStats = deliveryPartners.map((p) => {
    const myOrders = orders.filter((o) => o.delivery_person_id === p.id);
    const delivered = myOrders.filter((o) => o.status === "delivered");
    const inProgress = myOrders.filter((o) => o.status === "out_for_delivery");
    const totalEarnings = delivered.reduce((s, o) => s + Number(o.delivery_person_earning), 0);

    return {
      ...p,
      active: isActive(p),
      deliveredCount: delivered.length,
      inProgressCount: inProgress.length,
      totalEarnings,
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
        {partnerStats.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-500">No delivery partners yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-stone-500">
                  <th className="pb-2">Partner</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-center">In Progress</th>
                  <th className="pb-2 text-center">Delivered</th>
                  <th className="pb-2 text-right">Earnings</th>
                </tr>
              </thead>
              <tbody className="text-stone-300">
                {partnerStats.map((p) => (
                  <tr key={p.id} className="border-t border-white/10">
                    <td className="py-3">
                      <div>
                        <p className="font-semibold text-white">{p.full_name ?? "—"}</p>
                        {p.phone && <p className="text-xs text-stone-500">{p.phone}</p>}
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: p.active ? "#f5c518" : "#555" }}
                        />
                        {p.active ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      {p.inProgressCount > 0 ? (
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-lime-400/15 px-2 text-xs font-bold text-lime-300">
                          {p.inProgressCount}
                        </span>
                      ) : (
                        <span className="text-stone-600">0</span>
                      )}
                    </td>
                    <td className="py-3 text-center text-white">{p.deliveredCount}</td>
                    <td className="py-3 text-right font-semibold text-lime-400">
                      {formatCurrency(p.totalEarnings, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
