import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getSettings } from "@/lib/supabase/queries";
import { DeliveryCard } from "@/components/delivery/DeliveryCard";
import { AvailableDeliveryCard } from "@/components/delivery/AvailableDeliveryCard";
import { DeliveryRealtime } from "@/components/delivery/DeliveryRealtime";
import { DeliveryNav } from "@/components/delivery/DeliveryNav";
import { OnlineToggle } from "@/components/delivery/OnlineToggle";
import { MySettlements } from "@/components/delivery/MySettlements";
import { formatCurrency, getISTTimeBounds } from "@/lib/utils/formatters";
import { Truck, IndianRupee, Package } from "lucide-react";
import { DashboardRangeSelect } from "@/components/admin/DashboardRangeSelect";
import { DASHBOARD_RANGES, type DashboardRange } from "@/lib/constants/dashboard";
import type { Order, DeliverySettlement } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DeliveryDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const settings = await getSettings();
  const currency = settings.currency_symbol;

  const sp = await searchParams;
  const rangeKey = sp.range ?? "";
  const range: DashboardRange = rangeKey in DASHBOARD_RANGES ? (rangeKey as DashboardRange) : "all";
  const { label: rangeLabel, days: rangeDays, offsetDays } = DASHBOARD_RANGES[range];

  const { since, until: now } = getISTTimeBounds(rangeDays, offsetDays ?? 0);

  const [
    { data: assignedOrders },
    { data: availableOrders },
    { data: deliveredTodayOrders },
    { data: settlementsRaw },
  ] = await Promise.all([
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
        .gte("updated_at", since.toISOString())
        .lt("updated_at", now.toISOString()),
      supabase
        .from("delivery_settlements")
        .select("*")
        .eq("delivery_person_id", profile?.id ?? "")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const active = (assignedOrders as Order[]) ?? [];
  const available = (availableOrders as Order[]) ?? [];

  const deliveredToday = (deliveredTodayOrders as Pick<Order, "delivery_person_earning">[]) ?? [];
  const earningsToday = deliveredToday.reduce((s, o) => s + Number(o.delivery_person_earning), 0);

  const settlements = (settlementsRaw as DeliverySettlement[]) ?? [];

  return (
    <div>
      <DeliveryRealtime />

      <DeliveryNav />

      {/* Header with greeting */}
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold text-white">
          Hi, {profile?.full_name?.split(" ")[0] ?? "there"} 👋
        </h1>
        <p className="text-sm text-stone-500">Here are your deliveries.</p>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        <DashboardRangeSelect value={range} />
        <OnlineToggle initialOnline={profile?.is_online ?? false} shopIsOpen={settings.shop_is_open !== "false"} />
      </div>

      {/* Stats row */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Active deliveries</p>
            <Package className="h-4 w-4 text-stone-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-white">{active.length}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{rangeLabel} earnings</p>
            <IndianRupee className="h-4 w-4 text-stone-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-lime-400">{formatCurrency(earningsToday, currency)}</p>
          <p className="mt-1 text-xs text-stone-500">{deliveredToday.length} delivered {rangeLabel.toLowerCase()}</p>
        </div>
      </div>

      {/* Settlements awaiting confirmation + history */}
      <MySettlements settlements={settlements} currency={currency} />

      {/* Available orders */}
      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Available orders</h2>
          <span className="text-sm text-stone-500">{available.length} ready to claim</span>
        </div>
        {available.length === 0 ? (
          <div className="glass flex flex-col items-center rounded-2xl py-12 text-center text-stone-500">
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

      {/* My active orders */}
      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">My active orders</h2>
          <span className="text-sm text-stone-500">{active.length} assigned orders</span>
        </div>
        {active.length === 0 ? (
          <div className="glass flex flex-col items-center rounded-2xl py-12 text-center text-stone-500">
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
