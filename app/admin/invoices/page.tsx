import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { PageHeader } from "@/components/admin/StatCard";
import { tablePageClass } from "@/components/admin/TableShell";
import { InvoicesList } from "@/components/admin/InvoicesList";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const settings = await getSettings();

  const { data: orders } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });

  return (
    <div className={tablePageClass}>
      <PageHeader title="Invoices" subtitle={`${orders?.length ?? 0} invoices`} />
      <InvoicesList orders={(orders as Order[]) ?? []} settings={settings} />
    </div>
  );
}
