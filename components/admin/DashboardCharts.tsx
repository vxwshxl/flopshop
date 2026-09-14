"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatCurrency } from "@/lib/utils/formatters";
import { compactNumber, tooltipStyle } from "@/components/admin/chart-theme";

export function RevenueChart({
  data,
  currency = "₹",
}: {
  data: { date: string; revenue: number; orders: number }[];
  currency?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#d8d1bd" />
        <XAxis dataKey="date" stroke="#78716c" fontSize={11} />
        <YAxis stroke="#78716c" fontSize={11} tickFormatter={compactNumber} width={48} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v), currency)} />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#84cc16"
          strokeWidth={3}
          dot={data.length === 1 ? { r: 4, fill: "#84cc16" } : false}
          name="Revenue"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
