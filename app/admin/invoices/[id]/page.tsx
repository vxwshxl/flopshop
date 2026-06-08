import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { PageHeader } from "@/components/admin/StatCard";
import { Invoice } from "@/components/Invoice";
import { PrintButton } from "@/components/PrintButton";
import { PrintPortal } from "@/components/PrintPortal";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const settings = await getSettings();

  const { data } = await supabase.from("orders").select("*, order_items(*)").eq("id", id).single();
  if (!data) notFound();
  const order = data as Order;

  return (
    <div>
      <Link href="/admin/invoices" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to invoices
      </Link>
      <PageHeader
        title={order.invoice_number ?? order.order_number}
        subtitle="Invoice"
        action={<PrintButton label="Print" />}
      />
      <div className="mx-auto max-w-md rounded-xl bg-white p-6 shadow-lg">
        <Invoice order={order} settings={settings} />
      </div>

      <PrintPortal>
        <Invoice order={order} settings={settings} />
      </PrintPortal>
    </div>
  );
}
