import { createClient } from "@/lib/supabase/server";
import { getSettings, getActiveHostels } from "@/lib/supabase/queries";
import { StoreGrid } from "@/components/store/StoreGrid";
import { ProfileCompletionPrompt } from "@/components/store/ProfileCompletionPrompt";
import { ShopClosedBanner } from "@/components/store/ShopClosedBanner";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import type { Category, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const settings = await getSettings();

  const [{ data: categories }, { data: products }, hostels] = await Promise.all([
    supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
    supabase
      .from("products")
      .select("*, category:categories(*)")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    getActiveHostels(),
  ]);

  const sortedProducts = ((products as Product[]) ?? []).slice().sort((a, b) => {
    const aOutOfStock = (a.current_stock ?? 0) <= 0;
    const bOutOfStock = (b.current_stock ?? 0) <= 0;

    if (aOutOfStock !== bOutOfStock) {
      return aOutOfStock ? 1 : -1;
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <main>
      <RealtimeRefresh table="products" channel="store:products" />
      <RealtimeRefresh table="categories" channel="store:categories" />
      <RealtimeRefresh table="settings" channel="store:settings" />
      <ShopClosedBanner />
      <div className="mx-auto max-w-5xl px-4 pt-5">
        <h1 className="text-xl font-extrabold text-stone-950 dark:text-white">{settings.shop_tagline}</h1>
        <p className="text-sm text-stone-600 dark:text-stone-400">Pickup free • Delivery to your room +{settings.currency_symbol}{settings.delivery_fee}</p>
      </div>
      <StoreGrid
        categories={(categories as Category[]) ?? []}
        products={sortedProducts}
        currency={settings.currency_symbol}
      />
    </main>
  );
}
