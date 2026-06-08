import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { PageHeader } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/formatters";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { PurchasesTable } from "@/components/admin/PurchasesTable";
import type { Purchase } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const supabase = await createClient();
  const settings = await getSettings();
  const currency = settings.currency_symbol;

  const { data: purchases } = await supabase
    .from("purchases")
    .select("*")
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false });

  const list = (purchases as Purchase[]) ?? [];
  const totalSpent = list.reduce((s, p) => s + Number(p.total_cost), 0);

  return (
    <div>
      <RealtimeRefresh table="purchases" channel="admin:purchases" />
      <PageHeader
        title="Purchases"
        subtitle={`${list.length} purchases · ${formatCurrency(totalSpent, currency)} spent`}
        action={
          <Link href="/admin/purchases/new">
            <Button variant="dark">
              <Plus className="h-4 w-4" /> Add purchase
            </Button>
          </Link>
        }
      />

      <PurchasesTable purchases={list} currency={currency} />
    </div>
  );
}
