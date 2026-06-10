import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { MyOrdersList } from "@/components/store/MyOrdersList";
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
      <RealtimeRefresh table="orders" channel="my-orders" />
      <h1 className="mb-4 text-xl font-extrabold text-stone-950 dark:text-white">My Orders</h1>
      {list.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center text-stone-400">
          <Package className="mb-3 h-12 w-12" />
          No orders yet.
        </div>
      ) : (
        <MyOrdersList orders={list} currency={currency} />
      )}
    </div>
  );
}
