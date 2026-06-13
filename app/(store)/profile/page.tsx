import { redirect } from "next/navigation";
import { getCurrentProfile, getActiveHostels, getSettings } from "@/lib/supabase/queries";
import { ProfileView } from "@/components/store/ProfileView";
import { WalletCard } from "@/components/store/WalletCard";
import { getWalletWithTransactions } from "@/lib/server/wallet";
import { createClient } from "@/lib/supabase/server";
import type { WalletTopupRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [profile, hostels, settings] = await Promise.all([
    getCurrentProfile(),
    getActiveHostels(),
    getSettings(),
  ]);
  if (!profile) redirect("/login?redirect=/profile");

  const { wallet, transactions } = await getWalletWithTransactions({ profileId: profile.id });
  const supabase = await createClient();
  const { data: topups } = await supabase
    .from("wallet_topup_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (
    <div className="pb-8">
      <ProfileView profile={profile} hostels={hostels} />
      <WalletCard
        balance={wallet ? Number(wallet.balance) : 0}
        transactions={transactions}
        pendingTopups={(topups as WalletTopupRequest[] | null) ?? []}
        currency={settings.currency_symbol ?? "₹"}
      />
    </div>
  );
}
