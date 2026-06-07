import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getSettings } from "@/lib/supabase/queries";
import { DeliveryCard } from "@/components/delivery/DeliveryCard";
import { formatCurrency } from "@/lib/utils/formatters";
import { Truck } from "lucide-react";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DeliveryDashboard() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const settings = await getSettings();
  const currency = settings.currency_symbol;

  const { data: orders } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("delivery_person_id", profile?.id ?? "")
    .order("created_at", { ascending: false });

  const list = (orders as Order[]) ?? [];
  const active = list.filter((o) => o.status !== "delivered" && o.status !== "cancelled");

  const todayStr = new Date().toDateString();
  const deliveredToday = list.filter(
    (o) => o.status === "delivered" && new Date(o.updated_at).toDateString() === todayStr
  );
  const earningsToday = deliveredToday.reduce((s, o) => s + Number(o.delivery_person_earning), 0);

  return (
    <div>
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

      <h2 className="mb-3 mt-7 text-lg font-semibold text-white">Active orders</h2>
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
    </div>
  );
}
