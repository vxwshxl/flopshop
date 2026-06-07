import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getSettings } from "@/lib/supabase/queries";
import { OrderStatusBadge } from "@/components/store/OrderStatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DeliveryHistory() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const settings = await getSettings();
  const currency = settings.currency_symbol;

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("delivery_person_id", profile?.id ?? "")
    .eq("status", "delivered")
    .order("updated_at", { ascending: false });

  const list = (orders as Order[]) ?? [];

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const sum = (arr: Order[]) => arr.reduce((s, o) => s + Number(o.delivery_person_earning), 0);
  const weekEarnings = sum(list.filter((o) => new Date(o.updated_at) >= startOfWeek));
  const monthEarnings = sum(list.filter((o) => new Date(o.updated_at) >= startOfMonth));
  const totalEarnings = sum(list);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Delivery History</h1>
      <p className="text-sm text-gray-400">{list.length} completed deliveries</p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="This week" value={formatCurrency(weekEarnings, currency)} />
        <Stat label="This month" value={formatCurrency(monthEarnings, currency)} />
        <Stat label="All time" value={formatCurrency(totalEarnings, currency)} />
      </div>

      <div className="mt-6 space-y-2">
        {list.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-[#1a1d23] py-12 text-center text-gray-500">
            No completed deliveries yet.
          </div>
        )}
        {list.map((o) => (
          <div key={o.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#1a1d23] p-4">
            <div>
              <p className="font-semibold text-white">{o.order_number}</p>
              <p className="text-xs text-gray-500">
                {o.customer_name} · Room {o.customer_room ?? "—"} · {formatDateTime(o.updated_at)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-green-400">
                +{formatCurrency(o.delivery_person_earning, currency)}
              </span>
              <OrderStatusBadge status={o.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1d23] p-4">
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-green-400">{value}</p>
    </div>
  );
}
