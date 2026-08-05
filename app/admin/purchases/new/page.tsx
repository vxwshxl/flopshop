import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/StatCard";
import { PurchaseForm } from "@/components/admin/PurchaseForm";
import type { Product, Supplier } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewPurchasePage({
  searchParams,
}: {
  /** `?product=<id>` preselects it — set when coming back from Add Product. */
  searchParams: Promise<{ product?: string }>;
}) {
  const supabase = await createClient();
  const [{ product }, { data: products }, { data: suppliers }] = await Promise.all([
    searchParams,
    supabase.from("products").select("*").eq("is_active", true).order("name"),
    supabase.from("suppliers").select("*").eq("is_active", true).order("name"),
  ]);

  return (
    <div>
      <PageHeader title="New Purchase" subtitle="Restock inventory" />
      {(products?.length ?? 0) === 0 ? (
        <p className="text-gray-500">Add a product first.</p>
      ) : (
        <PurchaseForm
          products={(products as Product[]) ?? []}
          suppliers={(suppliers as Supplier[]) ?? []}
          initialProductId={product}
        />
      )}
    </div>
  );
}
