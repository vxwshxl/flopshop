"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Download } from "lucide-react";
import { StatCard, AdminCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { formatCurrency, toISODate } from "@/lib/utils/formatters";
import type { Category, Product, Purchase, SettingsMap } from "@/lib/types";

interface ReportOrder {
  id: string;
  status: string;
  order_type: "pickup" | "delivery";
  created_at: string;
  subtotal: number;
  total_amount: number;
  delivery_fee: number;
  delivery_person_earning: number;
  admin_delivery_earning: number;
  order_items: {
    quantity: number;
    total_price: number;
    product_name: string;
    product: { cost_price: number; category_id: string | null } | null;
  }[];
}

const tabs = ["Sales", "Profit", "Inventory"] as const;
type Tab = (typeof tabs)[number];

const PIE_COLORS = ["#f59e0b", "#3b82f6", "#ef4444", "#10b981", "#8b5cf6", "#ec4899"];
const tooltipStyle = { backgroundColor: "#0a0a0a", border: "1px solid #333", borderRadius: 8, fontSize: 12 };

export function ReportsView({
  orders,
  products,
  purchases,
  categories,
  settings,
}: {
  orders: ReportOrder[];
  products: Product[];
  purchases: Purchase[];
  categories: Category[];
  settings: SettingsMap;
}) {
  const currency = settings.currency_symbol ?? "₹";
  const [tab, setTab] = useState<Tab>("Sales");

  const defFrom = new Date();
  defFrom.setDate(defFrom.getDate() - 29);
  const [from, setFrom] = useState(toISODate(defFrom));
  const [to, setTo] = useState(toISODate(new Date()));

  const catName = useMemo(
    () => new Map(categories.map((c) => [c.id, `${c.icon} ${c.name}`])),
    [categories]
  );

  const inRange = useCallback(
    (d: string) => {
      const day = d.slice(0, 10);
      return day >= from && day <= to;
    },
    [from, to]
  );

  const validOrders = useMemo(
    () => orders.filter((o) => o.status !== "cancelled" && inRange(o.created_at)),
    [orders, inRange]
  );
  const rangePurchases = useMemo(
    () => purchases.filter((p) => inRange(p.purchase_date)),
    [purchases, inRange]
  );

  // ---- Sales metrics ----
  const totalRevenue = validOrders.reduce((s, o) => s + Number(o.total_amount), 0);
  const totalItems = validOrders.reduce(
    (s, o) => s + o.order_items.reduce((a, it) => a + it.quantity, 0),
    0
  );
  const aov = validOrders.length ? totalRevenue / validOrders.length : 0;

  const dailySeries = useMemo(() => {
    const map = new Map<string, { revenue: number; orders: number }>();
    validOrders.forEach((o) => {
      const key = o.created_at.slice(0, 10);
      const e = map.get(key) ?? { revenue: 0, orders: 0 };
      e.revenue += Number(o.total_amount);
      e.orders += 1;
      map.set(key, e);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date: date.slice(5), ...v }));
  }, [validOrders]);

  const productAgg = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number; cost: number }>();
    validOrders.forEach((o) =>
      o.order_items.forEach((it) => {
        const e = map.get(it.product_name) ?? { name: it.product_name, qty: 0, revenue: 0, cost: 0 };
        e.qty += it.quantity;
        e.revenue += Number(it.total_price);
        e.cost += it.quantity * Number(it.product?.cost_price ?? 0);
        map.set(it.product_name, e);
      })
    );
    return Array.from(map.values());
  }, [validOrders]);

  const topProducts = [...productAgg].sort((a, b) => b.qty - a.qty).slice(0, 8);

  const categoryAgg = useMemo(() => {
    const map = new Map<string, number>();
    validOrders.forEach((o) =>
      o.order_items.forEach((it) => {
        const id = it.product?.category_id ?? "other";
        map.set(id, (map.get(id) ?? 0) + Number(it.total_price));
      })
    );
    return Array.from(map.entries()).map(([id, value]) => ({ name: catName.get(id) ?? "Other", value }));
  }, [validOrders, catName]);

  // ---- Profit metrics ----
  const productRevenue = validOrders.reduce((s, o) => s + Number(o.subtotal), 0);
  const cogs = productAgg.reduce((s, p) => s + p.cost, 0);
  const grossProfit = productRevenue - cogs;
  const purchaseCost = rangePurchases.reduce((s, p) => s + Number(p.total_cost), 0);
  const deliveryTotals = validOrders.reduce(
    (acc, o) => {
      acc.fee += Number(o.delivery_fee);
      acc.person += Number(o.delivery_person_earning);
      acc.admin += Number(o.admin_delivery_earning);
      return acc;
    },
    { fee: 0, person: 0, admin: 0 }
  );
  const netProfit = grossProfit + deliveryTotals.admin;

  // ---- Inventory ----
  const stockValue = products.reduce((s, p) => s + p.current_stock * Number(p.cost_price), 0);
  const lowStock = products.filter((p) => p.current_stock <= p.minimum_stock);

  function exportCSV() {
    const rows = [
      ["Date", "Orders", "Revenue"],
      ...dailySeries.map((d) => [d.date, String(d.orders), String(d.revenue)]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flopshop-sales-${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === t ? "bg-white text-black" : "bg-[#1a1a1a] text-gray-400 hover:text-white"
              }`}
            >
              {t} Report
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-[#333] bg-[#1a1a1a] px-2 text-sm text-white" />
          <span className="text-gray-500">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-[#333] bg-[#1a1a1a] px-2 text-sm text-white" />
        </div>
      </div>

      {tab === "Sales" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Total Orders" value={validOrders.length} />
            <StatCard label="Revenue" value={formatCurrency(totalRevenue, currency)} />
            <StatCard label="Items Sold" value={totalItems} />
            <StatCard label="Avg Order Value" value={formatCurrency(aov, currency)} />
          </div>

          <AdminCard
            title="Daily Sales"
            action={
              <Button size="sm" variant="outline" onClick={exportCSV} className="border-[#333] text-gray-300">
                <Download className="h-4 w-4" /> CSV
              </Button>
            }
          >
            {dailySeries.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">No sales in range.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dailySeries} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="date" stroke="#666" fontSize={11} />
                  <YAxis stroke="#666" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} name="Revenue ₹" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </AdminCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <AdminCard title="Top Selling Products">
              <table className="w-full text-sm text-gray-300">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="pb-2">Product</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-gray-500">No data</td>
                    </tr>
                  )}
                  {topProducts.map((p) => (
                    <tr key={p.name} className="border-t border-[#222]">
                      <td className="py-2">{p.name}</td>
                      <td className="py-2 text-right">{p.qty}</td>
                      <td className="py-2 text-right">{formatCurrency(p.revenue, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminCard>

            <AdminCard title="Sales by Category">
              {categoryAgg.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-500">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={categoryAgg} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {categoryAgg.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </AdminCard>
          </div>
        </div>
      )}

      {tab === "Profit" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Product Revenue" value={formatCurrency(productRevenue, currency)} />
            <StatCard label="Cost of Goods" value={formatCurrency(cogs, currency)} />
            <StatCard label="Gross Profit" value={formatCurrency(grossProfit, currency)} hint="Revenue − COGS" />
            <StatCard label="Net Profit" value={formatCurrency(netProfit, currency)} hint="+ admin delivery share" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <AdminCard title="Profit / Loss per Product">
              <table className="w-full text-sm text-gray-300">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="pb-2">Product</th>
                    <th className="pb-2 text-right">Revenue</th>
                    <th className="pb-2 text-right">Cost</th>
                    <th className="pb-2 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {productAgg.length === 0 && (
                    <tr><td colSpan={4} className="py-6 text-center text-gray-500">No data</td></tr>
                  )}
                  {productAgg.map((p) => {
                    const profit = p.revenue - p.cost;
                    return (
                      <tr key={p.name} className="border-t border-[#222]">
                        <td className="py-2">{p.name}</td>
                        <td className="py-2 text-right">{formatCurrency(p.revenue, currency)}</td>
                        <td className="py-2 text-right">{formatCurrency(p.cost, currency)}</td>
                        <td className={`py-2 text-right font-medium ${profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {formatCurrency(profit, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </AdminCard>

            <div className="space-y-4">
              <AdminCard title="Delivery Earnings">
                <div className="space-y-2 text-sm">
                  <Line label="Total delivery fees" value={formatCurrency(deliveryTotals.fee, currency)} />
                  <Line label="Delivery persons earned" value={formatCurrency(deliveryTotals.person, currency)} />
                  <Line label="Shop (admin share)" value={formatCurrency(deliveryTotals.admin, currency)} />
                </div>
              </AdminCard>
              <AdminCard title="Purchase Cost (in range)">
                <p className="text-2xl font-bold text-white">{formatCurrency(purchaseCost, currency)}</p>
                <p className="mt-1 text-xs text-gray-500">{rangePurchases.length} purchase records</p>
              </AdminCard>
            </div>
          </div>
        </div>
      )}

      {tab === "Inventory" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard label="Total Products" value={products.length} />
            <StatCard label="Low Stock Items" value={lowStock.length} />
            <StatCard label="Stock Value (cost)" value={formatCurrency(stockValue, currency)} />
          </div>

          <AdminCard title="Current Stock Levels">
            <table className="w-full text-sm text-gray-300">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="pb-2">Product</th>
                  <th className="pb-2 text-right">Stock</th>
                  <th className="pb-2 text-right">Min</th>
                  <th className="pb-2 text-right">Cost</th>
                  <th className="pb-2 text-right">Stock Value</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-[#222]">
                    <td className="py-2">{p.name}</td>
                    <td className={`py-2 text-right font-medium ${p.current_stock <= 0 ? "text-red-400" : p.current_stock <= p.minimum_stock ? "text-amber-400" : "text-green-400"}`}>
                      {p.current_stock}
                    </td>
                    <td className="py-2 text-right text-gray-500">{p.minimum_stock}</td>
                    <td className="py-2 text-right">{formatCurrency(p.cost_price, currency)}</td>
                    <td className="py-2 text-right">{formatCurrency(p.current_stock * Number(p.cost_price), currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminCard>
        </div>
      )}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-gray-400">
      <span>{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
