import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/StatCard";
import { ProductForm } from "@/components/admin/ProductForm";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewProductPage({
  searchParams,
}: {
  /** `?returnTo=<path>` sends the admin back where they came from on save. */
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const supabase = await createClient();
  const [{ returnTo }, { data: categories }] = await Promise.all([
    searchParams,
    supabase.from("categories").select("*").order("sort_order"),
  ]);

  return (
    <div>
      <PageHeader title="Add Product" subtitle="Create a new product" />
      <ProductForm categories={(categories as Category[]) ?? []} returnTo={returnTo} />
    </div>
  );
}
