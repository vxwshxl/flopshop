import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { OrderStatusBadge } from "@/components/store/OrderStatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import { Package } from "lucide-react";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MyOrdersPage() {
  const supabase = await createClient();
  const settings = await getSettings();
  const currency = settings.currency_symbol;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: orders } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false });

  const list = (orders as Order[]) ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      <h1 className="mb-4 text-xl font-bold text-gray-900">My Orders</h1>
      {list.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center text-gray-400">
          <Package className="mb-3 h-12 w-12" />
          No orders yet.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="block rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">{o.order_number}</span>
                <OrderStatusBadge status={o.status} />
              </div>
              <div className="mt-1 flex items-center justify-between text-sm text-gray-500">
                <span>
                  {o.order_items?.length ?? 0} item{(o.order_items?.length ?? 0) > 1 ? "s" : ""} ·{" "}
                  {o.order_type === "delivery" ? "Delivery" : "Pickup"}
                </span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(o.total_amount, currency)}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-400">{formatDateTime(o.created_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
