import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { PageHeader } from "@/components/admin/StatCard";
import { ManualOrderForm } from "@/components/admin/ManualOrderForm";
import type { Customer, Product } from "@/lib/types";
import type { ManualOrderUser } from "@/components/admin/ManualOrderForm";

export const dynamic = "force-dynamic";

export default async function ManualOrderPage() {
  const supabase = await createClient();
  const settings = await getSettings();
  // Walk-in customers and signed-up app users are both payable accounts here —
  // an app user walking in should be charged their own profile wallet rather
  // than a duplicate walk-in record created under the same name.
  const [{ data: products }, { data: customers }, { data: users }, { data: walletRows }] =
    await Promise.all([
      supabase.from("products").select("*").eq("is_active", true).order("name"),
      supabase.from("customers").select("*").order("name"),
      supabase
        .from("profiles")
        .select("id, full_name, email, phone, room_number, hostel_block")
        .eq("is_active", true)
        .order("full_name"),
      supabase.from("wallets").select("customer_id, profile_id, balance"),
    ]);

  // Keyed by owner id — customer and profile ids are distinct uuids, so one map
  // serves both kinds of account.
  const balances: Record<string, number> = {};
  for (const w of (walletRows as
    | { customer_id: string | null; profile_id: string | null; balance: number }[]
    | null) ?? []) {
    const ownerId = w.customer_id ?? w.profile_id;
    if (ownerId) balances[ownerId] = Number(w.balance);
  }

  return (
    <div>
      <PageHeader title="Manual Order" subtitle="Create a walk-in order" />
      <ManualOrderForm
        products={(products as Product[]) ?? []}
        customers={(customers as Customer[]) ?? []}
        users={(users as ManualOrderUser[]) ?? []}
        balances={balances}
        settings={settings}
      />
    </div>
  );
}
