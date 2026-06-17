import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getSettings } from "@/lib/supabase/queries";
import { PageHeader, StatCard } from "@/components/admin/StatCard";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { ShareholderSettlement, type ProfitSettlementRow } from "@/components/admin/ShareholderSettlement";
import { ShareholdersManager } from "@/components/admin/ShareholdersManager";
import { computeProfitPool, type ProfitOrder } from "@/lib/utils/shareholders";
import { formatCurrency } from "@/lib/utils/formatters";
import type { ProfitSettlement, Shareholder } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ShareholdersPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const settings = await getSettings();
  const currency = settings.currency_symbol ?? "₹";

  const [{ data: ordersRaw }, { data: shareholdersRaw }, { data: settlementsRaw }] = await Promise.all([
    supabase
      .from("orders")
      .select("created_at, status, subtotal, admin_delivery_earning, order_items(quantity, cost_price)")
      .not("status", "eq", "cancelled"),
    supabase.from("shareholders").select("*").order("sort_order", { ascending: true }),
    supabase
      .from("profit_settlements")
      .select("*, shares:profit_settlement_shares(*)")
      .order("settled_through", { ascending: false }),
  ]);

  const orders = (ordersRaw as unknown as ProfitOrder[]) ?? [];
  const shareholders = (shareholdersRaw as Shareholder[]) ?? [];
  const activeShareholders = shareholders.filter((s) => s.is_active);
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
    note: s.note,
    created_at: s.created_at,
    shares: [...(s.shares ?? [])]
      .sort((a, b) => Number(b.share_percent) - Number(a.share_percent))
      .map((sh) => ({
        id: sh.id,
        name: sh.name,
        type: sh.type,
        share_percent: Number(sh.share_percent),
        amount: Number(sh.amount),
      })),
  }));

  return (
    <div>
      <RealtimeRefresh table="orders" channel="admin:shareholders:orders" />
      <RealtimeRefresh table="shareholders" channel="admin:shareholders:roster" />
      <RealtimeRefresh table="profit_settlements" channel="admin:shareholders:settlements" />
      <PageHeader title="Shareholders" subtitle="Profit distribution & settlements" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Profit balance" value={formatCurrency(outstanding, currency)} hint="Since last settlement" />
        <StatCard label="Total distributed" value={formatCurrency(totalSettled, currency)} />
        <StatCard label="Lifetime profit" value={formatCurrency(lifetime, currency)} hint="All time" />
      </div>

      <ShareholderSettlement
        outstanding={outstanding}
        shareholders={activeShareholders}
        history={history}
        currency={currency}
      />
      <ShareholdersManager shareholders={shareholders} />
    </div>
  );
}
