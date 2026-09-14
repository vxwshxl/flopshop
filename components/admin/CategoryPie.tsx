"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils/formatters";
import { PIE_COLORS, sharePct, tooltipStyle } from "@/components/admin/chart-theme";

/**
 * A donut plus a readable legend list.
 *
 * Recharts' built-in `label` printed the raw float (`34.990000000005`) outside
 * each arc. Those strings reserved horizontal space, so the pie was squeezed
 * down to fit them and the ones that still didn't fit were clipped at the card
 * edge. The numbers live in the list below instead — formatted, with their
 * share — which leaves the arc the card's full width.
 *
 * Shared by the dashboard and Reports, so the two screens agree on colour.
 */
export function CategoryPie({
  data,
  currency = "₹",
  empty = "No sales yet.",
}: {
  data: { name: string; value: number }[];
  currency?: string;
  empty?: string;
}) {
  if (!data.length) return <p className="py-10 text-center text-sm text-gray-500">{empty}</p>;
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-[200px] w-full">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={86}
              paddingAngle={data.length > 1 ? 2 : 0}
              stroke="none"
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v, name) => [
                `${formatCurrency(Number(v), currency)} · ${sharePct(Number(v), total)}`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">Total</p>
            <p className="num text-sm font-extrabold text-white">{formatCurrency(total, currency)}</p>
          </div>
        </div>
      </div>

      <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-stone-300" title={d.name}>
              {d.name}
            </span>
            <span className="num shrink-0 font-semibold text-white">
              {formatCurrency(d.value, currency)}
            </span>
            <span className="num w-11 shrink-0 text-right text-stone-500">{sharePct(d.value, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
