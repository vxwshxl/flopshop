import { getSettings, getCurrentProfile } from "@/lib/supabase/queries";
import { CheckoutView } from "@/components/store/CheckoutView";
import { getWalletBalance } from "@/lib/server/wallet";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const settings = await getSettings();
  const profile = await getCurrentProfile();
  const walletBalance = profile ? await getWalletBalance({ profileId: profile.id }) : 0;
  return <CheckoutView settings={settings} initialProfile={profile} walletBalance={walletBalance} />;
}
