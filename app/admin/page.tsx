import Link from "next/link";
import { ShoppingBag, IndianRupee, Package, AlertTriangle, Clock, Truck, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/supabase/queries";
import { StatCard, AdminCard, PageHeader } from "@/components/admin/StatCard";
import { ShopStatusToggle } from "@/components/admin/ShopStatusToggle";
import { RevenueChart, CategoryPie } from "@/components/admin/DashboardCharts";
import { DashboardRangeSelect } from "@/components/admin/DashboardRangeSelect";
import { DASHBOARD_RANGES, type DashboardRange } from "@/lib/constants/dashboard";
import { OrderStatusBadge } from "@/components/store/OrderStatusBadge";
import { formatCurrency, getISTTimeBounds, toISTDate } from "@/lib/utils/formatters";
import type { Category, OrderStatus, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

interface DashOrder {
  id: string;
  order_number: string;
  customer_name: string;
  order_type: "pickup" | "delivery";
  status: string;
  total_amount: number;
  created_at: string;
  delivery_person_earning: number;
  admin_delivery_earning: number;
  order_items: { quantity: number; total_price: number; product: { category_id: string | null } | null }[];
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const supabase = await createClient();
  const settings = await getSettings();
  const currency = settings.currency_symbol;

  const sp = await searchParams;
  const rangeKey = sp.range ?? "";
  const range: DashboardRange = rangeKey in DASHBOARD_RANGES ? (rangeKey as DashboardRange) : "today";
  const { label: rangeLabel, days: rangeDays, offsetDays } = DASHBOARD_RANGES[range];

  const { since, until: now } = getISTTimeBounds(rangeDays, offsetDays ?? 0);

  const [{ data: ordersRaw }, { data: products }, { data: categories }, { data: profiles }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, order_type, status, total_amount, created_at, delivery_person_earning, admin_delivery_earning, order_items(quantity, total_price, product:products(category_id))"
      )
      .gte("created_at", since.toISOString())
      .lt("created_at", now.toISOString())
      .order("created_at", { ascending: false }),
    supabase.from("products").select("*").eq("is_active", true),
    supabase.from("categories").select("*"),
    supabase.from("profiles").select("id, is_active"),
  ]);

  const orders = (ordersRaw as unknown as DashOrder[]) ?? [];
  const productList = (products as Product[]) ?? [];
  const cats = (categories as Category[]) ?? [];
  const catName = new Map(cats.map((c) => [c.id, `${c.icon} ${c.name}`]));

  const notCancelled = (o: DashOrder) => o.status !== "cancelled";

  // All stats below are scoped to the selected range.
  const rangeOrders = orders.filter(notCancelled);
  const rangeRevenue = rangeOrders.reduce((s, o) => s + Number(o.total_amount), 0);
  const profileList = (profiles as { id: string; is_active: boolean }[]) ?? [];
  const totalUsers = profileList.length;
  const activeUsers = profileList.filter((p) => p.is_active).length;
  const lowStock = productList.filter((p) => p.current_stock <= p.minimum_stock);
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const activeDeliveries = orders.filter((o) => o.status === "out_for_delivery").length;
  const deliveryEarnings = rangeOrders.reduce(
    (acc, o) => {
      acc.person += Number(o.delivery_person_earning);
      acc.admin += Number(o.admin_delivery_earning);
      return acc;
    },
    { person: 0, admin: 0 }
  );

  // Revenue series across the range — daily buckets for short ranges, monthly
  // for long ones so the chart stays readable.
  const days: { date: string; revenue: number; orders: number }[] = [];
  if (rangeDays > 31) {
    const cursor = toISTDate(since);
    cursor.setDate(1);
    const end = toISTDate(now);
    end.setDate(1);
    while (cursor <= end) {
      const monthOrders = rangeOrders.filter((o) => {
        const od = toISTDate(o.created_at);
        return od.getFullYear() === cursor.getFullYear() && od.getMonth() === cursor.getMonth();
      });
      days.push({
        date: cursor.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        revenue: monthOrders.reduce((s, o) => s + Number(o.total_amount), 0),
        orders: monthOrders.length,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else {
    // If it's exact end of day, now might be 00:00:00 of the next day.
    // If we include it in the loop with <= toISTDate(now), we might render an empty next day.
    // So we loop up to until - 1ms.
    const endBound = new Date(now.getTime() - 1);
    for (let d = toISTDate(since); d <= toISTDate(endBound); d.setDate(d.getDate() + 1)) {
      const key = d.toDateString();
      const dayOrders = rangeOrders.filter((o) => toISTDate(o.created_at).toDateString() === key);
      days.push({
        date: new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        revenue: dayOrders.reduce((s, o) => s + Number(o.total_amount), 0),
        orders: dayOrders.length,
      });
    }
  }

  // Category breakdown
  const catTotals = new Map<string, number>();
  orders.filter(notCancelled).forEach((o) =>
    o.order_items?.forEach((it) => {
      const id = it.product?.category_id ?? "uncategorized";
      catTotals.set(id, (catTotals.get(id) ?? 0) + Number(it.total_price));
    })
  );
  const pieData = Array.from(catTotals.entries()).map(([id, value]) => ({
    name: catName.get(id) ?? "Other",
    value,
  }));

  const recent = orders.slice(0, 10);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={<div className="mt-1"><DashboardRangeSelect value={range} /></div>}
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="w-full sm:w-80"><ShopStatusToggle initialOpen={settings.shop_is_open !== "false"} /></div>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Orders" value={rangeOrders.length} icon={<ShoppingBag className="h-4 w-4" />} />
        <StatCard label="Revenue" value={formatCurrency(rangeRevenue, currency)} icon={<IndianRupee className="h-4 w-4" />} />
        <StatCard label="Active Products" value={productList.length} icon={<Package className="h-4 w-4" />} />
        <StatCard label="Low Stock" value={lowStock.length} icon={<AlertTriangle className="h-4 w-4" />} hint={lowStock.length ? "Needs restock" : "All good"} />
        <StatCard label="Pending Orders" value={pendingCount} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Out for Delivery" value={activeDeliveries} icon={<Truck className="h-4 w-4" />} />
      </div>

      {/* Users tracking card */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5 lg:col-span-1">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-white/50">Users</p>
              <p className="mt-1 text-3xl font-extrabold text-white">{totalUsers}</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/5 text-white/70">
              <Users className="h-5 w-5" />
            </div>
            <div className="text-right">
              <p className="text-sm text-white/50">Active</p>
              <p className="mt-1 text-3xl font-extrabold text-white">{activeUsers}</p>
            </div>
          </div>
          <div className="mt-4 border-t border-white/10 pt-3 text-center text-sm text-white/40">
            Registered Profiles
          </div>
        </div>

        <StatCard
          className="lg:col-span-1"
          label="Orders in range"
          value={rangeOrders.length}
          hint={rangeLabel.toLowerCase()}
          icon={<ShoppingBag className="h-4 w-4" />}
        />
        <StatCard
          className="lg:col-span-1"
          label="Inactive Users"
          value={totalUsers - activeUsers}
          hint="deactivated accounts"
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <AdminCard title={`Revenue · ${rangeLabel}`} className="lg:col-span-2">
          <RevenueChart data={days} />
        </AdminCard>
        <AdminCard title="Sales by Category">
          <CategoryPie data={pieData} />
        </AdminCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <AdminCard
          title="Recent Orders"
          className="lg:col-span-2"
          action={
            <Link href="/admin/orders" className="text-xs font-semibold text-lime-700 hover:underline dark:text-lime-300">
              View all
            </Link>
          }
        >
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-500 dark:text-stone-500">No recent orders.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-stone-500 dark:text-stone-500">
                    <th className="pb-2">Order</th>
                    <th className="pb-2">Customer</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Total</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="text-stone-700 dark:text-stone-300">
                  {recent.map((o) => (
                    <tr key={o.id} className="border-t border-black/10 dark:border-white/10">
                      <td className="py-2">
                        <Link href={`/admin/orders/${o.id}`} className="font-semibold text-lime-700 hover:underline dark:text-lime-300">
                          {o.order_number}
                        </Link>
                      </td>
                      <td className="py-2">{o.customer_name}</td>
                      <td className="py-2 capitalize">{o.order_type}</td>
                      <td className="py-2">{formatCurrency(o.total_amount, currency)}</td>
                      <td className="py-2">
                        <OrderStatusBadge status={o.status as OrderStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>

        <div className="space-y-4">
          <AdminCard title="Low Stock Alerts">
            {lowStock.length === 0 ? (
              <p className="py-6 text-center text-sm text-stone-500 dark:text-stone-500">Everything is stocked.</p>
            ) : (
              <ul className="space-y-2">
                {lowStock.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <Link href={`/admin/products/${p.id}`} className="text-stone-700 hover:text-stone-950 dark:text-stone-300 dark:hover:text-white">
                      {p.name}
                    </Link>
                    <span className="font-semibold text-red-400">{p.current_stock} left</span>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard title={`Delivery Earnings · ${rangeLabel}`}>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-stone-600 dark:text-stone-400">
                <span>Delivery persons</span>
                <span className="text-stone-950 dark:text-white">{formatCurrency(deliveryEarnings.person, currency)}</span>
              </div>
              <div className="flex justify-between text-stone-600 dark:text-stone-400">
                <span>Shop (admin share)</span>
                <span className="text-stone-950 dark:text-white">{formatCurrency(deliveryEarnings.admin, currency)}</span>
              </div>
            </div>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
