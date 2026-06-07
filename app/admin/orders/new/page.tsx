import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { PageHeader } from "@/components/admin/StatCard";
import { ManualOrderForm } from "@/components/admin/ManualOrderForm";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ManualOrderPage() {
  const supabase = await createClient();
  const settings = await getSettings();
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name");

  return (
    <div>
      <PageHeader title="Manual Order" subtitle="Create a walk-in order" />
      <ManualOrderForm products={(products as Product[]) ?? []} settings={settings} />
    </div>
  );
}
