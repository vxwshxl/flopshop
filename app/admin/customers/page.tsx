import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/queries";
import { CustomersManager } from "@/components/admin/CustomersManager";
import type { Customer, Hostel } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("*").order("name");

  const { data: hostelsData } = await supabase
    .from("hostels")
    .select("*")
    .eq("is_active", true)
    .order("name");

  // Wallet balances keyed by customer id (for the credit column).
  const { data: walletRows } = await supabase
    .from("wallets")
    .select("customer_id, balance")
    .not("customer_id", "is", null);
  const balances: Record<string, number> = {};
  for (const w of (walletRows as { customer_id: string; balance: number }[] | null) ?? []) {
    balances[w.customer_id] = Number(w.balance);
  }

  return (
    <CustomersManager
      customers={(data as Customer[]) ?? []}
      hostels={(hostelsData as Hostel[]) ?? []}
      balances={balances}
    />
  );
}
