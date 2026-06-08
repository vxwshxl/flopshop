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
      <h1 className="text-2xl font-extrabold text-white">Delivery History</h1>
      <p className="text-sm text-stone-500">{list.length} completed deliveries</p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="This week" value={formatCurrency(weekEarnings, currency)} />
        <Stat label="This month" value={formatCurrency(monthEarnings, currency)} />
        <Stat label="All time" value={formatCurrency(totalEarnings, currency)} />
      </div>

      <div className="mt-6 space-y-2">
        {list.length === 0 && (
          <div className="glass flex flex-col items-center rounded-2xl py-12 text-center text-stone-500">
            No completed deliveries yet.
          </div>
        )}
        {list.map((o) => (
          <div key={o.id} className="glass flex items-center justify-between rounded-2xl p-4">
            <div>
              <p className="font-semibold text-white">{o.order_number}</p>
              <p className="text-xs text-stone-500">
                {o.customer_name} · Room {o.customer_room ?? "—"} · {formatDateTime(o.updated_at)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-lime-400">
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
    <div className="glass rounded-2xl p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-2 text-xl font-extrabold text-lime-400">{value}</p>
    </div>
  );
}
