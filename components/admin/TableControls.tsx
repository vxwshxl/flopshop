"use client";

import { Search, ArrowUpDown } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { SortDir } from "@/lib/hooks/useTableControls";

const inputDark =
  "h-10 w-full rounded-lg border border-[#333] bg-[#1a1a1a] pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none";

/** Search box + optional date range, shared by every admin table. */
export function TableToolbar({
  query,
  onQuery,
  placeholder = "Search…",
  from,
  to,
  onFrom,
  onTo,
  hasDateFilter,
  onClearDates,
  showDateRange = true,
  searchHiddenOnMobile = false,
  children,
}: {
  query: string;
  onQuery: (v: string) => void;
  placeholder?: string;
  from?: string;
  to?: string;
  onFrom?: (v: string) => void;
  onTo?: (v: string) => void;
  hasDateFilter?: boolean;
  onClearDates?: () => void;
  showDateRange?: boolean;
  /** Hide the search box below `lg` (the page renders its own compact search). */
  searchHiddenOnMobile?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
      {/* Search + first control share a row on mobile; `lg:contents` lets them
          flow as normal flex items in the desktop row. */}
      <div className="flex gap-2 lg:contents">
        <div className={cn("relative min-w-0 flex-1 lg:min-w-[200px]", searchHiddenOnMobile && "hidden lg:block")}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} className={inputDark} />
        </div>
        {children}
      </div>
      {showDateRange && onFrom && onTo && (
        <div className="flex items-center justify-center gap-2 lg:justify-start">
          <DatePicker value={from ?? ""} onChange={onFrom} className="w-36" />
          <span className="text-white/40">→</span>
          <DatePicker value={to ?? ""} onChange={onTo} className="w-36" />
          {hasDateFilter && onClearDates && (
            <Button size="sm" variant="outline" onClick={onClearDates}>
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** A clickable, sort-aware <th>. Use inside a <tr>. */
export function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className = "",
  defaultDir = "asc",
}: {
  label: string;
  sortKey: string;
  activeKey: string;
  dir: SortDir;
  onSort: (key: string, defaultDir?: SortDir) => void;
  className?: string;
  defaultDir?: SortDir;
}) {
  const active = activeKey === sortKey;
  return (
    <th className={`p-3 ${className}`}>
      <button onClick={() => onSort(sortKey, defaultDir)} className="inline-flex items-center gap-1 hover:text-white">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active ? "text-lime-400" : "opacity-40"}`} />
        {active && <span className="text-[10px] text-lime-400">{dir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}
