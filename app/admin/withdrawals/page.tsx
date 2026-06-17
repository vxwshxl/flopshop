import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getSettings } from "@/lib/supabase/queries";
import { PageHeader, StatCard } from "@/components/admin/StatCard";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { WithdrawalsManager } from "@/components/admin/WithdrawalsManager";
import { formatCurrency } from "@/lib/utils/formatters";
import type { Withdrawal } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function WithdrawalsPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const settings = await getSettings();
  const currency = settings.currency_symbol ?? "₹";

  const { data } = await supabase.from("withdrawals").select("*").order("date", { ascending: false });
  const rows = (data as Withdrawal[]) ?? [];

  const total = rows.reduce((s, w) => s + Number(w.amount), 0);
  const upi = rows.filter((w) => w.method === "upi").reduce((s, w) => s + Number(w.amount), 0);
  const cash = rows.filter((w) => w.method === "cash").reduce((s, w) => s + Number(w.amount), 0);

  return (
    <div>
      <RealtimeRefresh table="withdrawals" channel="admin:withdrawals" />
      <PageHeader title="Withdrawals" subtitle="Money taken out of revenue (cash / UPI)" />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total withdrawn" value={formatCurrency(total, currency)} hint={`${rows.length} entries`} />
        <StatCard label="UPI" value={formatCurrency(upi, currency)} />
        <StatCard label="Cash" value={formatCurrency(cash, currency)} />
      </div>

      <WithdrawalsManager withdrawals={rows} currency={currency} />
    </div>
  );
}
