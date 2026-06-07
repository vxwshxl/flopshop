import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/StatCard";
import { CategoriesManager } from "@/components/admin/CategoriesManager";
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
    <div>
      <PageHeader title="Categories" subtitle={`${categories?.length ?? 0} categories`} />
      <CategoriesManager categories={(categories as Category[]) ?? []} counts={counts} />
    </div>
  );
}
