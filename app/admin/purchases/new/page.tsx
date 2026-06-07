import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/StatCard";
import { PurchaseForm } from "@/components/admin/PurchaseForm";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewPurchasePage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name");

  return (
    <div>
      <PageHeader title="New Purchase" subtitle="Restock inventory" />
      {(products?.length ?? 0) === 0 ? (
        <p className="text-gray-500">Add a product first.</p>
      ) : (
        <PurchaseForm products={(products as Product[]) ?? []} />
      )}
    </div>
  );
}
