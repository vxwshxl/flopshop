/** Dashboard date-range options — shared between server (page.tsx) and client (DashboardRangeSelect). */
export const DASHBOARD_RANGES = {
  today: { label: "Today", days: 1, offsetDays: 0 },
  yesterday: { label: "Yesterday", days: 1, offsetDays: 1 },
  week: { label: "Last Week", days: 7, offsetDays: 0 },
  month: { label: "Last Month", days: 30, offsetDays: 0 },
  "6month": { label: "Last 6 Months", days: 182, offsetDays: 0 },
  year: { label: "Last Year", days: 365, offsetDays: 0 },
  all: { label: "All Time", days: 36500, offsetDays: 0 },
} as const;

export type DashboardRange = keyof typeof DASHBOARD_RANGES;
