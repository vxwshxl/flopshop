"use client";

import { useState } from "react";

export type SortDir = "asc" | "desc";

/**
 * Shared admin-table controls: text search, a date range, and named sorters.
 * Returns the filtered + sorted rows plus the bound state. Lists here are small
 * (admin scale), so we filter/sort on every render rather than memoising.
 */
export function useTableControls<T>(
  items: T[],
  opts: {
    /** strings on each row to match the search query against */
    searchFields?: (item: T) => (string | null | undefined)[];
    /** a date-ish string (ISO or YYYY-MM-DD…) used for the from/to range */
    dateField?: (item: T) => string | null | undefined;
    /** named comparators, e.g. { name: (a,b)=>…, date: (a,b)=>… } */
    sorters: Record<string, (a: T, b: T) => number>;
    initialSort?: string;
    initialDir?: SortDir;
  }
) {
  const keys = Object.keys(opts.sorters);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortKey, setSortKey] = useState(opts.initialSort ?? keys[0] ?? "");
  const [dir, setDir] = useState<SortDir>(opts.initialDir ?? "desc");

  const q = query.trim().toLowerCase();
  let rows = items.filter((it) => {
    const matchQ =
      !q || (opts.searchFields?.(it) ?? []).some((s) => (s ?? "").toLowerCase().includes(q));
    const day = (opts.dateField?.(it) ?? "").slice(0, 10);
    const matchFrom = !from || (!!day && day >= from);
    const matchTo = !to || (!!day && day <= to);
    return matchQ && matchFrom && matchTo;
  });

  const cmp = opts.sorters[sortKey];
  if (cmp) {
    const m = dir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => m * cmp(a, b));
  }

  function toggleSort(key: string, defaultDir: SortDir = "asc") {
    if (sortKey === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir(defaultDir);
    }
  }

  const hasDateFilter = !!from || !!to;
  function clearDates() {
    setFrom("");
    setTo("");
  }

  return {
    rows,
    query,
    setQuery,
    from,
    setFrom,
    to,
    setTo,
    hasDateFilter,
    clearDates,
    sortKey,
    dir,
    toggleSort,
  };
}

/** Case-insensitive string comparator for a field accessor. */
export function byText<T>(get: (x: T) => string | null | undefined) {
  return (a: T, b: T) => (get(a) ?? "").toLowerCase().localeCompare((get(b) ?? "").toLowerCase());
}

/** Numeric comparator for a field accessor. */
export function byNum<T>(get: (x: T) => number | null | undefined) {
  return (a: T, b: T) => (Number(get(a)) || 0) - (Number(get(b)) || 0);
}

/** Date/string comparator (works on ISO timestamps and YYYY-MM-DD). */
export function byDate<T>(get: (x: T) => string | null | undefined) {
  return (a: T, b: T) => (get(a) ?? "").localeCompare(get(b) ?? "");
}
