import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getSettings } from "@/lib/supabase/queries";
import { PageHeader, StatCard } from "@/components/admin/StatCard";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { ShareholderSettlement, type ProfitSettlementRow } from "@/components/admin/ShareholderSettlement";
import { computeProfitPool, type ProfitOrder } from "@/lib/utils/shareholders";
import { formatCurrency } from "@/lib/utils/formatters";
import type { ProfitSettlement } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ShareholdersPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const settings = await getSettings();
  const currency = settings.currency_symbol ?? "₹";

  const [{ data: ordersRaw }, { data: settlementsRaw }] = await Promise.all([
    supabase
      .from("orders")
      .select("created_at, status, subtotal, admin_delivery_earning, order_items(quantity, cost_price)")
      .not("status", "eq", "cancelled"),
    supabase
      .from("profit_settlements")
      .select("*")
      .order("settled_through", { ascending: false }),
  ]);

  const orders = (ordersRaw as unknown as ProfitOrder[]) ?? [];
  const settlements = (settlementsRaw as ProfitSettlement[]) ?? [];
  const lastSettledThrough = settlements[0]?.settled_through ?? null;

  // Outstanding pool (since last settlement), lifetime pool, and total paid out.
  const outstanding = computeProfitPool(orders, lastSettledThrough);
  const lifetime = computeProfitPool(orders, null);
  const totalSettled = settlements.reduce((s, x) => s + Number(x.profit_base), 0);

  const history: ProfitSettlementRow[] = settlements.map((s) => ({
    id: s.id,
    profit_base: Number(s.profit_base),
    settled_through: s.settled_through,
    philip_amount: Number(s.philip_amount),
    zau_amount: Number(s.zau_amount),
    vee_amount: Number(s.vee_amount),
    note: s.note,
    created_at: s.created_at,
  }));

  return (
    <div>
      <RealtimeRefresh table="orders" channel="admin:shareholders:orders" />
      <RealtimeRefresh table="profit_settlements" channel="admin:shareholders:settlements" />
      <PageHeader title="Shareholders" subtitle="Profit distribution — Philip 50% · Zau 40% · Vee 10%" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Profit balance" value={formatCurrency(outstanding, currency)} hint="Since last settlement" />
        <StatCard label="Total distributed" value={formatCurrency(totalSettled, currency)} />
        <StatCard label="Lifetime profit" value={formatCurrency(lifetime, currency)} hint="All time" />
      </div>

      <ShareholderSettlement outstanding={outstanding} history={history} currency={currency} />
    </div>
  );
}
