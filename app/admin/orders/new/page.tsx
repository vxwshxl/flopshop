import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { PageHeader } from "@/components/admin/StatCard";
import { ManualOrderForm } from "@/components/admin/ManualOrderForm";
import type { Customer, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ManualOrderPage() {
  const supabase = await createClient();
  const settings = await getSettings();
  const [{ data: products }, { data: customers }, { data: walletRows }] = await Promise.all([
    supabase.from("products").select("*").eq("is_active", true).order("name"),
    supabase.from("customers").select("*").order("name"),
    supabase.from("wallets").select("customer_id, balance").not("customer_id", "is", null),
  ]);

  const balances: Record<string, number> = {};
  for (const w of (walletRows as { customer_id: string; balance: number }[] | null) ?? []) {
    balances[w.customer_id] = Number(w.balance);
  }

  return (
    <div>
      <PageHeader title="Manual Order" subtitle="Create a walk-in order" />
      <ManualOrderForm
        products={(products as Product[]) ?? []}
        customers={(customers as Customer[]) ?? []}
        balances={balances}
        settings={settings}
      />
    </div>
  );
}
