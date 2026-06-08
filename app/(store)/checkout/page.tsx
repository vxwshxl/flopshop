import { getSettings, getCurrentProfile } from "@/lib/supabase/queries";
import { CheckoutView } from "@/components/store/CheckoutView";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const settings = await getSettings();
  const profile = await getCurrentProfile();
  return <CheckoutView settings={settings} initialProfile={profile} />;
}
