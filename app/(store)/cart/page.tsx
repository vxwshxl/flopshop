import { getSettings } from "@/lib/supabase/queries";
import { CartView } from "@/components/store/CartView";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const settings = await getSettings();
  return <CartView settings={settings} />;
}
