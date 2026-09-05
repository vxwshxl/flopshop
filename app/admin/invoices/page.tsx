import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { getSettings } from "@/lib/supabase/queries";
import { PageHeader } from "@/components/admin/StatCard";
import { tablePageClass } from "@/components/admin/TableShell";
import { InvoicesList } from "@/components/admin/InvoicesList";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const settings = await getSettings();

  // Every order is an invoice, so this list has to span the whole table rather
  // than PostgREST's first 1000 rows.
  const orders = await fetchAllRows<Order>((from, to) =>
    supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to)
  );

  return (
    <div className={tablePageClass}>
      <PageHeader title="Invoices" subtitle={`${orders.length} invoices`} />
      <InvoicesList orders={orders} settings={settings} />
    </div>
  );
}
