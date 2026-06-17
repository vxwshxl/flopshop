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
import Link from "next/link";
import { Download, ChevronRight } from "lucide-react";
import { StatCard, AdminCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { TableToolbar, SortHeader } from "@/components/admin/TableControls";
import { useTableControls, byText, byNum } from "@/lib/hooks/useTableControls";
import { formatCurrency, formatDate, istDateString, paymentSplit } from "@/lib/utils/formatters";
import { computeProfitPool, splitPool, PROFIT_START_LABEL } from "@/lib/utils/shareholders";
import type { Category, Product, Purchase, SettingsMap, Shareholder } from "@/lib/types";

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
  payment_method: string;
  paid_cash: number;
  paid_upi: number;
  order_items: {
    quantity: number;
    total_price: number;
    product_name: string;
    cost_price: number;
    product: { category_id: string | null } | null;
  }[];
}

const tabs = ["Sales", "Profit", "Inventory"] as const;
type Tab = (typeof tabs)[number];

const PIE_COLORS = ["#f59e0b", "#3b82f6", "#ef4444", "#10b981", "#8b5cf6", "#ec4899"];
const INCOME_COLORS: Record<string, string> = {
  Cash: "#10b981",
  UPI: "#3b82f6",
  "Bank Transfer": "#f59e0b",
  "Wallet/Credit": "#a3e635",
  Other: "#6b7280",
};
const tooltipStyle = { backgroundColor: "#0a0a0a", border: "1px solid #333", borderRadius: 8, fontSize: 12 };

export function ReportsView({
  orders,
  products,
  purchases,
  categories,
  settings,
  shareholders = [],
  lastSettledThrough = null,
}: {
  orders: ReportOrder[];
  products: Product[];
  purchases: Purchase[];
  categories: Category[];
  settings: SettingsMap;
  /** Active shareholder roster, used to break down the profit pool. */
  shareholders?: Shareholder[];
  /** Cutoff of the latest shareholder settlement; the card shows profit accrued since. */
  lastSettledThrough?: string | null;
}) {
  const currency = settings.currency_symbol ?? "₹";
  const [tab, setTab] = useState<Tab>("Sales");

  // Default the range to start at the very first sale on record (so it always
  // covers all history), falling back to 29 days ago when there are no orders.
  const [from, setFrom] = useState(() => {
    let earliest = "";
    for (const o of orders) {
      const day = istDateString(o.created_at);
      if (!earliest || day < earliest) earliest = day;
    }
    if (earliest) return earliest;
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return istDateString(d);
  });
  // End the range at "today" in IST so the latest sales are always included.
  const [to, setTo] = useState(istDateString());

  const catName = useMemo(
    () => new Map(categories.map((c) => [c.id, `${c.icon} ${c.name}`])),
    [categories]
  );

  const inRange = useCallback(
    (d: string) => {
      const day = istDateString(d);
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

  // Income by payment method — split orders contribute to both cash & UPI.
  const income = useMemo(
    () =>
      validOrders.reduce(
        (acc, o) => {
          const s = paymentSplit(o);
          acc.cash += s.cash;
          acc.upi += s.upi;
          acc.bank += s.bank;
          acc.credit += s.credit;
          acc.other += s.other;
          return acc;
        },
        { cash: 0, upi: 0, bank: 0, credit: 0, other: 0 }
      ),
    [validOrders]
  );
  const incomePie = useMemo(
    () =>
      [
        { name: "Cash", value: income.cash },
        { name: "UPI", value: income.upi },
        { name: "Bank Transfer", value: income.bank },
        { name: "Wallet/Credit", value: income.credit },
        { name: "Other", value: income.other },
      ].filter((d) => d.value > 0),
    [income]
  );

  const dailySeries = useMemo(() => {
    const map = new Map<string, { revenue: number; orders: number }>();
    validOrders.forEach((o) => {
      const key = istDateString(o.created_at);
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
        e.cost += it.quantity * Number(it.cost_price ?? 0);
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
  // Shareholder profit pool — item margin + the shop's delivery share, owned in
  // full by the shareholders. After a settlement, only orders created since its
  // cutoff count, so the card reflects the OUTSTANDING (unsettled) balance.
  const profitPool = computeProfitPool(validOrders, lastSettledThrough);
  const profitSplit = splitPool(profitPool, shareholders);
  const netProfit = grossProfit + deliveryTotals.admin;

  // Profit/Loss per product — searchable, sortable, paginated.
  const profitRows = useMemo(
    () => productAgg.map((p) => ({ ...p, profit: p.revenue - p.cost })),
    [productAgg]
  );
  const pfCtl = useTableControls(profitRows, {
    searchFields: (p) => [p.name],
    sorters: {
      name: byText((p) => p.name),
      revenue: byNum((p) => p.revenue),
      cost: byNum((p) => p.cost),
      profit: byNum((p) => p.profit),
    },
    initialSort: "profit",
    initialDir: "desc",
  });
  const pfPag = usePagination(pfCtl.rows);

  // ---- Inventory ----
  const stockValue = products.reduce((s, p) => s + p.current_stock * Number(p.cost_price), 0);
  const lowStock = products.filter((p) => p.current_stock <= p.minimum_stock);

  // Current stock levels — searchable, sortable, paginated.
  const stockRows = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        name: p.name,
        stock: p.current_stock,
        min: p.minimum_stock,
        cost: Number(p.cost_price),
        value: p.current_stock * Number(p.cost_price),
      })),
    [products]
  );
  const invCtl = useTableControls(stockRows, {
    searchFields: (p) => [p.name],
    sorters: {
      name: byText((p) => p.name),
      stock: byNum((p) => p.stock),
      min: byNum((p) => p.min),
      cost: byNum((p) => p.cost),
      value: byNum((p) => p.value),
    },
    initialSort: "name",
    initialDir: "asc",
  });
  const invPag = usePagination(invCtl.rows);

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
      <div className="mb-4 flex flex-col items-center gap-3 lg:flex-row lg:justify-between">
        <div className="flex justify-center gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === t ? "bg-white text-black" : "bg-[#1a1a1a] text-gray-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2">
          <DatePicker value={from} onChange={setFrom} className="w-40" />
          <span className="text-white/40">→</span>
          <DatePicker value={to} onChange={setTo} className="w-40" />
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

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Cash Income" value={formatCurrency(income.cash, currency)} />
            <StatCard label="UPI Income" value={formatCurrency(income.upi, currency)} />
            <StatCard label="Wallet/Credit" value={formatCurrency(income.credit, currency)} hint="Paid from store credit" />
            <StatCard label="Bank / Other" value={formatCurrency(income.bank + income.other, currency)} />
          </div>

          <AdminCard title="Income by Payment Method">
            {incomePie.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">No income in range.</p>
            ) : (
              <div className="grid items-center gap-4 sm:grid-cols-2">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={incomePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                      {incomePie.map((d) => (
                        <Cell key={d.name} fill={INCOME_COLORS[d.name] ?? "#8b5cf6"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v), currency)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 text-sm">
                  <Line label="Cash" value={formatCurrency(income.cash, currency)} />
                  <Line label="UPI" value={formatCurrency(income.upi, currency)} />
                  {income.credit > 0 && <Line label="Wallet/Credit" value={formatCurrency(income.credit, currency)} />}
                  {income.bank > 0 && <Line label="Bank Transfer" value={formatCurrency(income.bank, currency)} />}
                  {income.other > 0 && <Line label="Other" value={formatCurrency(income.other, currency)} />}
                </div>
              </div>
            )}
          </AdminCard>

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
            <StatCard label="Net Profit" value={formatCurrency(netProfit, currency)} hint="+ admin delivery" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <AdminCard title="Delivery Earnings">
              <div className="space-y-2 text-sm">
                <Line label="Total delivery fees" value={formatCurrency(deliveryTotals.fee, currency)} />
                <Line label="Delivery persons earned" value={formatCurrency(deliveryTotals.person, currency)} />
                <Line label="Shop (admin share)" value={formatCurrency(deliveryTotals.admin, currency)} />
              </div>
            </AdminCard>
            <div className="grid grid-cols-2 gap-4 lg:col-span-2">
              <AdminCard title="Purchase Cost">
                <p className="text-2xl font-bold text-white">{formatCurrency(purchaseCost, currency)}</p>
                <p className="mt-1 text-xs text-gray-500">{rangePurchases.length} purchase records</p>
              </AdminCard>
              <Link href="/admin/shareholders" className="block">
                <AdminCard title="Shareholder Split">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-2xl font-bold text-white">{formatCurrency(profitPool, currency)}</p>
                      <div className="mt-1 space-y-0.5 text-xs text-gray-500">
                        {profitSplit.map((sh) => (
                          <p key={sh.id}>
                            · {sh.name} {Number(sh.share_percent)}% — {formatCurrency(sh.amount, currency)}
                          </p>
                        ))}
                        <p>
                          ·{" "}
                          {lastSettledThrough
                            ? `since last settlement ${formatDate(lastSettledThrough)}`
                            : `${PROFIT_START_LABEL} onwards`}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
                  </div>
                </AdminCard>
              </Link>
            </div>
          </div>

          <AdminCard title="Profit / Loss per Product">
            <TableToolbar
              query={pfCtl.query}
              onQuery={pfCtl.setQuery}
              placeholder="Search product…"
              showDateRange={false}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-300">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <SortHeader label="Product" sortKey="name" activeKey={pfCtl.sortKey} dir={pfCtl.dir} onSort={pfCtl.toggleSort} className="!p-0 !pb-2" />
                    <SortHeader label="Revenue" sortKey="revenue" activeKey={pfCtl.sortKey} dir={pfCtl.dir} onSort={pfCtl.toggleSort} className="!p-0 !pb-2 text-right" defaultDir="desc" />
                    <SortHeader label="Cost" sortKey="cost" activeKey={pfCtl.sortKey} dir={pfCtl.dir} onSort={pfCtl.toggleSort} className="!p-0 !pb-2 text-right" defaultDir="desc" />
                    <SortHeader label="Profit" sortKey="profit" activeKey={pfCtl.sortKey} dir={pfCtl.dir} onSort={pfCtl.toggleSort} className="!p-0 !pb-2 text-right" defaultDir="desc" />
                  </tr>
                </thead>
                <tbody>
                  {pfPag.pageItems.length === 0 && (
                    <tr><td colSpan={4} className="py-6 text-center text-gray-500">No data</td></tr>
                  )}
                  {pfPag.pageItems.map((p) => (
                    <tr key={p.name} className="border-t border-[#222]">
                      <td className="py-2">{p.name}</td>
                      <td className="py-2 text-right">{formatCurrency(p.revenue, currency)}</td>
                      <td className="py-2 text-right">{formatCurrency(p.cost, currency)}</td>
                      <td className={`py-2 text-right font-medium ${p.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {formatCurrency(p.profit, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={pfPag.page}
              totalPages={pfPag.totalPages}
              perPage={pfPag.perPage}
              total={pfPag.total}
              onPage={pfPag.setPage}
              onPerPage={pfPag.setPerPage}
            />
          </AdminCard>
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
            <TableToolbar
              query={invCtl.query}
              onQuery={invCtl.setQuery}
              placeholder="Search product…"
              showDateRange={false}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-300">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <SortHeader label="Product" sortKey="name" activeKey={invCtl.sortKey} dir={invCtl.dir} onSort={invCtl.toggleSort} className="!p-0 !pb-2" />
                    <SortHeader label="Stock" sortKey="stock" activeKey={invCtl.sortKey} dir={invCtl.dir} onSort={invCtl.toggleSort} className="!p-0 !pb-2 text-right" defaultDir="desc" />
                    <SortHeader label="Min" sortKey="min" activeKey={invCtl.sortKey} dir={invCtl.dir} onSort={invCtl.toggleSort} className="!p-0 !pb-2 text-right" defaultDir="desc" />
                    <SortHeader label="Cost" sortKey="cost" activeKey={invCtl.sortKey} dir={invCtl.dir} onSort={invCtl.toggleSort} className="!p-0 !pb-2 text-right" defaultDir="desc" />
                    <SortHeader label="Stock Value" sortKey="value" activeKey={invCtl.sortKey} dir={invCtl.dir} onSort={invCtl.toggleSort} className="!p-0 !pb-2 text-right" defaultDir="desc" />
                  </tr>
                </thead>
                <tbody>
                  {invPag.pageItems.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-gray-500">No products</td></tr>
                  )}
                  {invPag.pageItems.map((p) => (
                    <tr key={p.id} className="border-t border-[#222]">
                      <td className="py-2">{p.name}</td>
                      <td className={`py-2 text-right font-medium ${p.stock <= 0 ? "text-red-400" : p.stock <= p.min ? "text-amber-400" : "text-green-400"}`}>
                        {p.stock}
                      </td>
                      <td className="py-2 text-right text-gray-500">{p.min}</td>
                      <td className="py-2 text-right">{formatCurrency(p.cost, currency)}</td>
                      <td className="py-2 text-right">{formatCurrency(p.value, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={invPag.page}
              totalPages={invPag.totalPages}
              perPage={invPag.perPage}
              total={invPag.total}
              onPage={invPag.setPage}
              onPerPage={invPag.setPerPage}
            />
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
