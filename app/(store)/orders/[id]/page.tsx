import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { Invoice } from "@/components/Invoice";
import { PrintButton } from "@/components/PrintButton";
import { OrderStatusBadge } from "@/components/store/OrderStatusBadge";
import { ORDER_STATUSES, STATUS_LABELS } from "@/lib/utils/orderHelpers";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const settings = await getSettings();

  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const order = data as Order;

  // Build a simple progress timeline (skips cancelled which is terminal).
  const flow =
    order.order_type === "delivery"
      ? ORDER_STATUSES.filter((s) => s !== "cancelled")
      : ORDER_STATUSES.filter((s) => s !== "cancelled" && s !== "out_for_delivery");
  const currentIdx = (flow as Order["status"][]).indexOf(order.status);

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      <Link href="/orders" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{order.order_number}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <PrintButton label="Print invoice" />
      </div>

      {order.status !== "cancelled" && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          {flow.map((s, i) => (
            <div key={s} className="flex flex-1 flex-col items-center text-center">
              <div
                className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                  i <= currentIdx ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-400"
                }`}
              >
                {i + 1}
              </div>
              <span className="mt-1 text-[10px] text-gray-500">{STATUS_LABELS[s]}</span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <Invoice order={order} settings={settings} />
      </div>
    </div>
  );
}
