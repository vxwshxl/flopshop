import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getSettings } from "@/lib/supabase/queries";
import { PageHeader, StatCard } from "@/components/admin/StatCard";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { DeveloperSettlement, type DevSettlementRow } from "@/components/admin/DeveloperSettlement";
import { computeDevShare, DEV_FEE_RATE, type DevShareOrder } from "@/lib/utils/devShare";
import { formatCurrency } from "@/lib/utils/formatters";
import type { DeveloperSettlement as DevSettlement } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DeveloperPage() {
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
      .from("developer_settlements")
      .select("*")
      .order("settled_through", { ascending: false }),
  ]);

  const orders = (ordersRaw as unknown as DevShareOrder[]) ?? [];
  const settlements = (settlementsRaw as DevSettlement[]) ?? [];
  const lastSettledThrough = settlements[0]?.settled_through ?? null;

  // Lifetime accrued (from DEV_FEE_START), total already settled, and what's
  // still outstanding (accrued since the last settlement cutoff).
  const lifetime = computeDevShare(orders, null);
  const totalSettled = settlements.reduce((s, x) => s + Number(x.amount), 0);
  const outstanding = computeDevShare(orders, lastSettledThrough);

  const history: DevSettlementRow[] = settlements.map((s) => ({
    id: s.id,
    amount: Number(s.amount),
    profit_base: Number(s.profit_base),
    settled_through: s.settled_through,
    method: s.method ?? "cash",
    paid_cash: Number(s.paid_cash ?? 0),
    paid_upi: Number(s.paid_upi ?? 0),
    note: s.note,
    created_at: s.created_at,
  }));

  return (
    <div>
      <RealtimeRefresh table="orders" channel="admin:developer:orders" />
      <RealtimeRefresh table="developer_settlements" channel="admin:developer:settlements" />
      <PageHeader title="Developer" subtitle={`${DEV_FEE_RATE * 100}% profit share — accounting & settlements`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Outstanding share" value={formatCurrency(outstanding.share, currency)} hint="Since last settlement" />
        <StatCard label="Total settled" value={formatCurrency(totalSettled, currency)} />
        <StatCard label="Lifetime accrued" value={formatCurrency(lifetime.share, currency)} hint="All time" />
      </div>

      <DeveloperSettlement
        outstanding={outstanding.share}
        outstandingBase={outstanding.base}
        history={history}
        currency={currency}
      />
    </div>
  );
}
