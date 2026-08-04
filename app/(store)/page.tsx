import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { StoreGrid } from "@/components/store/StoreGrid";
import { ShopClosedBanner } from "@/components/store/ShopClosedBanner";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import type { Category, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();

  const [settings, { data: categories }, { data: products }] = await Promise.all([
    getSettings(),
    supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
    supabase
      .from("products")
      .select("*, category:categories(*)")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  // Already ordered newest-first by the query — this only floats in-stock items
  // above sold-out ones while preserving that order within each group.
  const sortedProducts = ((products as Product[]) ?? [])
    .slice()
    .sort((a, b) => Number((a.current_stock ?? 0) <= 0) - Number((b.current_stock ?? 0) <= 0));

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
