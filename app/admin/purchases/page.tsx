import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { getSettings } from "@/lib/supabase/queries";
import { PageHeader } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/formatters";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { PurchasesTable } from "@/components/admin/PurchasesTable";
import { tablePageClass } from "@/components/admin/TableShell";
import type { Purchase, Supplier } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const supabase = await createClient();
  const settings = await getSettings();
  const currency = settings.currency_symbol;

  // The header sums total spend over the whole table, and the table paginates
  // client-side — both need every row, not PostgREST's first 1000.
  const [list, { data: suppliers }] = await Promise.all([
    fetchAllRows<Purchase>((from, to) =>
      supabase
        .from("purchases")
        .select("*")
        .order("purchase_date", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to)
    ),
    supabase.from("suppliers").select("*").eq("is_active", true).order("name"),
  ]);
  const totalSpent = list.reduce((s, p) => s + Number(p.total_cost), 0);

  return (
    <div className={tablePageClass}>
      <RealtimeRefresh table="purchases" channel="admin:purchases" />
      <PageHeader
        title="Purchases"
        subtitle={
          <span className="hidden lg:inline">
            {list.length} purchases · {formatCurrency(totalSpent, currency)} spent
          </span>
        }
        action={
          <Link href="/admin/purchases/new">
            <Button variant="dark">
              <Plus className="h-4 w-4" /> Add purchase
            </Button>
          </Link>
        }
      />

      <PurchasesTable purchases={list} suppliers={(suppliers as Supplier[]) ?? []} currency={currency} />
    </div>
  );
}
