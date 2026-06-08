/** Dashboard date-range options — shared between server (page.tsx) and client (DashboardRangeSelect). */
export const DASHBOARD_RANGES = {
  today: { label: "Today", days: 1 },
  week: { label: "Last Week", days: 7 },
  month: { label: "Last Month", days: 30 },
  "6month": { label: "Last 6 Months", days: 182 },
  year: { label: "Last Year", days: 365 },
} as const;

export type DashboardRange = keyof typeof DASHBOARD_RANGES;
