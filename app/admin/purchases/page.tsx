import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { PageHeader } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
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

      <div className="overflow-x-auto rounded-xl border border-[#222] bg-[#1a1a1a]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#222] text-left text-xs text-gray-500">
              <th className="p-3">Date</th>
              <th className="p-3">Product</th>
              <th className="p-3">Qty</th>
              <th className="p-3">Unit Price</th>
              <th className="p-3">Total</th>
              <th className="p-3">Supplier</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No purchases recorded yet.
                </td>
              </tr>
            )}
            {list.map((p) => (
              <tr key={p.id} className="border-b border-[#222] last:border-0 hover:bg-white/5">
                <td className="p-3">{formatDate(p.purchase_date)}</td>
                <td className="p-3 font-medium text-white">{p.product_name}</td>
                <td className="p-3">{p.quantity}</td>
                <td className="p-3">{formatCurrency(p.unit_price, currency)}</td>
                <td className="p-3">{formatCurrency(p.total_cost, currency)}</td>
                <td className="p-3">{p.supplier ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
