/**
 * One visual language for every admin chart. Both the dashboard and Reports
 * used to carry their own copy of these — two different tooltip skins and two
 * different six-colour palettes, so the same "Sales by Category" slice was lime
 * on one screen and amber on the other.
 */

export const tooltipStyle = {
  backgroundColor: "#1c1a16",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  fontSize: 12,
  color: "#f7f3e8",
};

export const PIE_COLORS = ["#84cc16", "#f59e0b", "#06b6d4", "#ef4444", "#8b5cf6", "#14b8a6"];

/** Indian-notation axis ticks: 60000 -> 60k, 121128 -> 1.2L. Keeps the Y axis
 *  narrow (and the plot area wide) however far revenue climbs. */
export const compactNumber = (n: number) =>
  n >= 100_000 ? `${(n / 100_000).toFixed(1)}L` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`;

/** Share of a total, rounded so small slices never collapse to a bare "0%". */
export const sharePct = (value: number, total: number) => {
  if (!total) return "0%";
  const p = (value / total) * 100;
  return `${p >= 10 ? Math.round(p) : p.toFixed(1)}%`;
};
