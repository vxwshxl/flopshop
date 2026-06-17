import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { PageHeader } from "@/components/admin/StatCard";
import { ReportsView } from "@/components/admin/ReportsView";
import type { Category, Product, Purchase, Shareholder } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = await createClient();
  const settings = await getSettings();

  const [
    { data: orders },
    { data: products },
    { data: purchases },
    { data: categories },
    { data: shareholders },
    { data: settlements },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, status, order_type, created_at, subtotal, total_amount, delivery_fee, delivery_person_earning, admin_delivery_earning, payment_method, paid_cash, paid_upi, order_items(quantity, total_price, product_name, cost_price, product:products(category_id))"
      )
      .order("created_at", { ascending: false }),
    supabase.from("products").select("*").order("name"),
    supabase.from("purchases").select("*"),
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("shareholders").select("*").eq("is_active", true).order("sort_order"),
    supabase
      .from("shareholder_settlements")
      .select("shareholder_id, settled_through")
      .order("settled_through", { ascending: false }),
  ]);

  // Each shareholder's most recent cutoff → their outstanding profit since then.
  const cutoffById: Record<string, string> = {};
  for (const s of (settlements as { shareholder_id: string; settled_through: string }[] | null) ?? []) {
    if (!cutoffById[s.shareholder_id]) cutoffById[s.shareholder_id] = s.settled_through;
  }

  return (
    <div>
      <PageHeader title="Reports" subtitle="Sales, profit & inventory analytics" />
      <ReportsView
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        orders={(orders as any) ?? []}
        products={(products as Product[]) ?? []}
        purchases={(purchases as Purchase[]) ?? []}
        categories={(categories as Category[]) ?? []}
        settings={settings}
        shareholders={(shareholders as Shareholder[]) ?? []}
        cutoffById={cutoffById}
      />
    </div>
  );
}
