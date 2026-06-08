"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZES = [20, 50, 100, 500];

/**
 * Client-side pagination over an in-memory list. Page auto-clamps when the list
 * shrinks (e.g. filtering), and changing page size jumps back to page 1.
 */
export function usePagination<T>(items: T[], initialPerPage = 20) {
  const [perPage, setPerPageRaw] = useState(initialPerPage);
  const [page, setPage] = useState(1);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(page, totalPages);

  const pageItems = useMemo(
    () => items.slice((current - 1) * perPage, current * perPage),
    [items, current, perPage]
  );

  const setPerPage = (n: number) => {
    setPerPageRaw(n);
    setPage(1);
  };

  return { page: current, setPage, perPage, setPerPage, total, totalPages, pageItems };
}

export function Pagination({
  page,
  totalPages,
  perPage,
  total,
  onPage,
  onPerPage,
}: {
  page: number;
  totalPages: number;
  perPage: number;
  total: number;
  onPage: (p: number) => void;
  onPerPage: (n: number) => void;
}) {
  if (total === 0) return null;
  const start = (page - 1) * perPage + 1;
  const end = Math.min(total, page * perPage);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-black/60 dark:text-white/60">
      <div className="flex items-center gap-2">
        <span>Rows per page</span>
        <select
          value={perPage}
          onChange={(e) => onPerPage(Number(e.target.value))}
          className="h-8 rounded-lg border border-black/15 bg-white px-2 text-sm text-black focus:border-yellow-400 focus:outline-none dark:border-white/15 dark:bg-black dark:text-white"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <span>
          {start}–{end} of {total}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-black/15 disabled:opacity-40 hover:enabled:bg-yellow-400 hover:enabled:text-black dark:border-white/15"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPage(page + 1)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-black/15 disabled:opacity-40 hover:enabled:bg-yellow-400 hover:enabled:text-black dark:border-white/15"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
