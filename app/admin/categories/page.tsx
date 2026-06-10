import { createClient } from "@/lib/supabase/server";
import { CategoriesManager } from "@/components/admin/CategoriesManager";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const supabase = await createClient();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("products").select("category_id"),
  ]);

  const counts: Record<string, number> = {};
  (products ?? []).forEach((p: { category_id: string | null }) => {
    if (p.category_id) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;
  });

  return (
    <>
      <RealtimeRefresh table="categories" channel="admin:categories" />
      <CategoriesManager categories={(categories as Category[]) ?? []} counts={counts} />
    </>
  );
}
