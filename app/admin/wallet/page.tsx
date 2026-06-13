import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getSettings } from "@/lib/supabase/queries";
import { PageHeader } from "@/components/admin/StatCard";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { WalletTopups, type TopupRow } from "@/components/admin/WalletTopups";

export const dynamic = "force-dynamic";

type RawTopup = {
  id: string;
  amount: number;
  method: "cash" | "upi";
  reference: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  profile: { full_name: string | null; email: string | null } | null;
};

function toRow(r: RawTopup): TopupRow {
  return {
    id: r.id,
    amount: Number(r.amount),
    method: r.method,
    reference: r.reference,
    status: r.status,
    created_at: r.created_at,
    name: r.profile?.full_name ?? r.profile?.email ?? "User",
    email: r.profile?.email ?? null,
  };
}

export default async function AdminWalletPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const settings = await getSettings();

  const { data } = await supabase
    .from("wallet_topup_requests")
    .select("id, amount, method, reference, status, created_at, profile:profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(60);

  const rows = ((data as unknown as RawTopup[]) ?? []).map(toRow);
  const pending = rows.filter((r) => r.status === "pending");
  const history = rows.filter((r) => r.status !== "pending").slice(0, 20);

  return (
    <div>
      <RealtimeRefresh table="wallet_topup_requests" channel="admin:wallet:topups" />
      <PageHeader title="Wallet" subtitle="Verify and approve store-credit top-ups" />
      <WalletTopups pending={pending} history={history} currency={settings.currency_symbol ?? "₹"} />
    </div>
  );
}
