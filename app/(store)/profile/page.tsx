import { redirect } from "next/navigation";
import { getCurrentProfile, getActiveHostels, getSettings } from "@/lib/supabase/queries";
import { ProfileView } from "@/components/store/ProfileView";
import { WalletCard } from "@/components/store/WalletCard";
import { ShareholderAccountCard, type MySettlement } from "@/components/store/ShareholderAccountCard";
import { getWalletWithTransactions } from "@/lib/server/wallet";
import { createClient } from "@/lib/supabase/server";
import type { Shareholder, ShareholderSettlement, WalletTopupRequest } from "@/lib/types";

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

  // If this account is linked to a shareholder, show their payouts to confirm.
  const { data: myShareholderRaw } = await supabase
    .from("shareholders")
    .select("*")
    .eq("profile_id", profile.id)
    .maybeSingle();
  const myShareholder = myShareholderRaw as Shareholder | null;
  let mySettlements: MySettlement[] = [];
  if (myShareholder) {
    const { data } = await supabase
      .from("shareholder_settlements")
      .select("*")
      .eq("shareholder_id", myShareholder.id)
      .order("settled_through", { ascending: false });
    mySettlements = ((data as ShareholderSettlement[] | null) ?? []).map((s) => ({
      id: s.id,
      amount: Number(s.amount),
      settled_through: s.settled_through,
      status: s.status,
      confirmed_at: s.confirmed_at,
      note: s.note,
      created_at: s.created_at,
    }));
  }

  return (
    <div className="pb-8">
      <ProfileView profile={profile} hostels={hostels} />
      <WalletCard
        balance={wallet ? Number(wallet.balance) : 0}
        transactions={transactions}
        pendingTopups={(topups as WalletTopupRequest[] | null) ?? []}
        currency={settings.currency_symbol ?? "₹"}
      />
      {myShareholder && (
        <ShareholderAccountCard
          name={myShareholder.name}
          sharePercent={Number(myShareholder.share_percent)}
          settlements={mySettlements}
          currency={settings.currency_symbol ?? "₹"}
        />
      )}
    </div>
  );
}
