import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { PageHeader } from "@/components/admin/StatCard";
import { tablePageClass } from "@/components/admin/TableShell";
import { ProductsTable } from "@/components/admin/ProductsTable";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import type { Category, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const supabase = await createClient();
  const settings = await getSettings();

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").order("created_at", { ascending: false }),
    supabase.from("categories").select("*").order("sort_order"),
  ]);

  return (
    <div className={tablePageClass}>
      <RealtimeRefresh table="products" channel="admin:products" />
      <RealtimeRefresh table="categories" channel="admin:categories" />
      <PageHeader title="Products" subtitle={`${products?.length ?? 0} products`} />
      <ProductsTable
        products={(products as Product[]) ?? []}
        categories={(categories as Category[]) ?? []}
        currency={settings.currency_symbol}
      />
    </div>
  );
}
