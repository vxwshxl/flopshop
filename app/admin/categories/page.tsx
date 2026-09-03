import { createClient } from "@/lib/supabase/server";
import { CategoriesManager } from "@/components/admin/CategoriesManager";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { productCategoryIds } from "@/lib/utils/categories";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const supabase = await createClient();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("products").select("category_id, product_categories(category_id)"),
  ]);

  // A product in several categories counts once under each of them, so the
  // totals here can exceed the number of products — that's the honest figure.
  const counts: Record<string, number> = {};
  (products ?? []).forEach((p) => {
    for (const id of productCategoryIds(p)) counts[id] = (counts[id] ?? 0) + 1;
  });

  return (
    <>
      <RealtimeRefresh table="categories" channel="admin:categories" />
      <CategoriesManager categories={(categories as Category[]) ?? []} counts={counts} />
    </>
  );
}
