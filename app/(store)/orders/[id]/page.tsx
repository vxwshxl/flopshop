import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { Invoice } from "@/components/Invoice";
import { PrintButton } from "@/components/PrintButton";
import { PrintPortal } from "@/components/PrintPortal";
import { OrderStatusBadge } from "@/components/store/OrderStatusBadge";
import { CancelOrderButton } from "@/components/store/CancelOrderButton";
import { ORDER_STATUSES, STATUS_LABELS } from "@/lib/utils/orderHelpers";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const settings = await getSettings();

  const [{ data }, { data: auth }] = await Promise.all([
    supabase.from("orders").select("*, order_items(*)").eq("id", id).single(),
    supabase.auth.getUser(),
  ]);

  if (!data) notFound();
  const order = data as Order;
  // Only the customer who placed the order sees the OTP — delivery staff and
  // admins must ask for it to verify handover.
  const isOwner = !!auth.user && order.user_id === auth.user.id;
  // The customer can call off their own order while it's still pending/confirmed.
  const canCancel = isOwner && (order.status === "pending" || order.status === "confirmed");

  // Build a simple progress timeline (skips cancelled which is terminal).
  const flow =
    order.order_type === "delivery"
      ? ORDER_STATUSES.filter((s) => s !== "cancelled")
      : ORDER_STATUSES.filter((s) => s !== "cancelled" && s !== "out_for_delivery");
  const currentIdx = (flow as Order["status"][]).indexOf(order.status);

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      <RealtimeRefresh table="orders" channel={`order-${id}`} />
      <Link href="/orders" className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-950 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-stone-950 dark:text-white">{order.order_number}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <div className="flex items-center gap-2">
          {canCancel && <CancelOrderButton orderId={order.id} />}
          <PrintButton label="Print invoice" />
        </div>
      </div>

      {order.status !== "cancelled" && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-stone-900">
          {flow.map((s, i) => (
            <div key={s} className="flex flex-1 flex-col items-center text-center">
              <div
                className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                  i <= currentIdx
                    ? "bg-lime-500 text-stone-950"
                    : "bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500"
                }`}
              >
                {i + 1}
              </div>
              <span className="mt-1 text-[10px] text-stone-500 dark:text-stone-400">{STATUS_LABELS[s]}</span>
            </div>
          ))}
        </div>
      )}

      {order.order_type === "pickup" && settings.shop_address?.trim() && (
        <div className="mb-6 rounded-lg border border-lime-500/60 bg-lime-50 p-4 text-sm text-stone-700 dark:bg-lime-400/10 dark:text-stone-200">
          <span className="font-semibold">Pickup — collect from:</span> {settings.shop_address}
        </div>
      )}

      <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
        {/* OTP only for the owner, and only until handover (delivered/cancelled). */}
        <Invoice
          order={order}
          settings={settings}
          showOtp={isOwner && order.status !== "delivered" && order.status !== "cancelled"}
        />
      </div>

      <PrintPortal>
        <Invoice
          order={order}
          settings={settings}
          showOtp={isOwner && order.status !== "delivered" && order.status !== "cancelled"}
        />
      </PrintPortal>
    </div>
  );
}
