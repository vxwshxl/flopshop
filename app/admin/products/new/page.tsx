import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/StatCard";
import { ProductForm } from "@/components/admin/ProductForm";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("*").order("sort_order");
  return (
    <div>
      <PageHeader title="Add Product" subtitle="Create a new product" />
      <ProductForm categories={(categories as Category[]) ?? []} />
    </div>
  );
}
