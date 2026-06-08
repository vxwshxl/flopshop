import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getSettings } from "@/lib/supabase/queries";
import { DeliveryCard } from "@/components/delivery/DeliveryCard";
import { AvailableDeliveryCard } from "@/components/delivery/AvailableDeliveryCard";
import { DeliveryRealtime } from "@/components/delivery/DeliveryRealtime";
import { formatCurrency } from "@/lib/utils/formatters";
import { Truck } from "lucide-react";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DeliveryDashboard() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const settings = await getSettings();
  const currency = settings.currency_symbol;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [{ data: assignedOrders }, { data: availableOrders }, { data: deliveredTodayOrders }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("delivery_person_id", profile?.id ?? "")
        .not("status", "in", "(delivered,cancelled)")
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("*, order_items(*)")
        .is("delivery_person_id", null)
        .eq("order_type", "delivery")
        .not("status", "in", "(delivered,cancelled)")
        .order("created_at", { ascending: false }),
      // Delivered orders are excluded from `active`, so today's earnings need
      // their own query (this was the bug — earnings always showed ₹0).
      supabase
        .from("orders")
        .select("delivery_person_earning, updated_at")
        .eq("delivery_person_id", profile?.id ?? "")
        .eq("status", "delivered")
        .gte("updated_at", startOfDay.toISOString()),
    ]);

  const active = (assignedOrders as Order[]) ?? [];
  const available = (availableOrders as Order[]) ?? [];

  const deliveredToday = (deliveredTodayOrders as Pick<Order, "delivery_person_earning">[]) ?? [];
  const earningsToday = deliveredToday.reduce((s, o) => s + Number(o.delivery_person_earning), 0);

  return (
    <div>
      <DeliveryRealtime />
      <h1 className="text-2xl font-bold text-white">Hi, {profile?.full_name ?? "there"} 👋</h1>
      <p className="text-sm text-gray-400">Here are your deliveries.</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-[#1a1d23] p-4">
          <p className="text-xs uppercase text-gray-500">Active deliveries</p>
          <p className="mt-1 text-2xl font-bold text-white">{active.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#1a1d23] p-4">
          <p className="text-xs uppercase text-gray-500">Today&apos;s earnings</p>
          <p className="mt-1 text-2xl font-bold text-green-400">{formatCurrency(earningsToday, currency)}</p>
          <p className="text-xs text-gray-500">{deliveredToday.length} delivered today</p>
        </div>
      </div>

      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Available orders</h2>
          <span className="text-sm text-gray-400">{available.length} ready to claim</span>
        </div>
        {available.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#1a1d23] py-12 text-center text-gray-500">
            <Truck className="mx-auto mb-2 h-10 w-10" />
            No available orders to claim.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {available.map((o) => (
              <AvailableDeliveryCard key={o.id} order={o} currency={currency} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">My active orders</h2>
          <span className="text-sm text-gray-400">{active.length} assigned orders</span>
        </div>
        {active.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-white/10 bg-[#1a1d23] py-12 text-center text-gray-500">
            <Truck className="mb-2 h-10 w-10" />
            No active deliveries right now.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {active.map((o) => (
              <DeliveryCard key={o.id} order={o} currency={currency} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
