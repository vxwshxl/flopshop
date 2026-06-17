import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getSettings } from "@/lib/supabase/queries";
import { PageHeader, StatCard } from "@/components/admin/StatCard";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { ShareholderSettlements, type HolderView } from "@/components/admin/ShareholderSettlements";
import { ShareholdersManager, type LinkUser } from "@/components/admin/ShareholdersManager";
import { computeProfitPool, shareholderShare, type ProfitOrder } from "@/lib/utils/shareholders";
import { formatCurrency } from "@/lib/utils/formatters";
import type { ShareholderSettlement, Shareholder } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ShareholdersPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const settings = await getSettings();
  const currency = settings.currency_symbol ?? "₹";

  const [{ data: ordersRaw }, { data: shareholdersRaw }, { data: settlementsRaw }, { data: usersRaw }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("created_at, status, subtotal, admin_delivery_earning, order_items(quantity, cost_price)")
        .not("status", "eq", "cancelled"),
      supabase.from("shareholders").select("*").order("sort_order", { ascending: true }),
      supabase
        .from("shareholder_settlements")
        .select("*")
        .order("settled_through", { ascending: false }),
      supabase.from("profiles").select("id, email, full_name").order("full_name"),
    ]);

  const orders = (ordersRaw as unknown as ProfitOrder[]) ?? [];
  const shareholders = (shareholdersRaw as Shareholder[]) ?? [];
  const settlements = (settlementsRaw as ShareholderSettlement[]) ?? [];
  const users = (usersRaw as LinkUser[]) ?? [];
  const userById = new Map(users.map((u) => [u.id, u]));

  // Each shareholder's own last cutoff → their outstanding since then.
  const lastCutoff = new Map<string, string>();
  for (const s of settlements) {
    if (!lastCutoff.has(s.shareholder_id)) lastCutoff.set(s.shareholder_id, s.settled_through);
  }

  const holders: HolderView[] = shareholders.map((sh) => {
    const since = lastCutoff.get(sh.id) ?? null;
    const { base, amount } = shareholderShare(orders, sh, since);
    const linked = sh.profile_id ? userById.get(sh.profile_id) : undefined;
    return {
      id: sh.id,
      name: sh.name,
      type: sh.type,
      share_percent: Number(sh.share_percent),
      profit_from: sh.profit_from,
      is_active: sh.is_active,
      linkedLabel: linked ? linked.full_name || linked.email || "Linked account" : null,
      outstandingBase: base,
      outstandingAmount: amount,
      history: settlements
        .filter((s) => s.shareholder_id === sh.id)
        .map((s) => ({
          id: s.id,
          amount: Number(s.amount),
          profit_base: Number(s.profit_base),
          settled_through: s.settled_through,
          status: s.status,
          confirmed_at: s.confirmed_at,
          note: s.note,
          created_at: s.created_at,
        })),
    };
  });

  const totalOutstanding = holders
    .filter((h) => h.is_active)
    .reduce((s, h) => s + h.outstandingAmount, 0);
  const totalDistributed = settlements.reduce((s, x) => s + Number(x.amount), 0);
  const lifetime = computeProfitPool(orders, null);

  return (
    <div>
      <RealtimeRefresh table="orders" channel="admin:shareholders:orders" />
      <RealtimeRefresh table="shareholders" channel="admin:shareholders:roster" />
      <RealtimeRefresh table="shareholder_settlements" channel="admin:shareholders:settlements" />
      <PageHeader title="Shareholders" subtitle="Per-shareholder profit settlements" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Outstanding (all)" value={formatCurrency(totalOutstanding, currency)} hint="Unsettled across shareholders" />
        <StatCard label="Total distributed" value={formatCurrency(totalDistributed, currency)} />
        <StatCard label="Lifetime profit" value={formatCurrency(lifetime, currency)} hint="All time" />
      </div>

      <ShareholderSettlements holders={holders} currency={currency} />
      <ShareholdersManager shareholders={shareholders} users={users} />
    </div>
  );
}
