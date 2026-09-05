/**
 * PostgREST caps every response at `db-max-rows` — 1000 on Supabase — and it
 * does so *silently*: you ask for a table, you get the first 1000 rows and a
 * 200. No error, no flag on the response. Any page that counted or summed the
 * rows it got back therefore froze at ~1000 the moment the table crossed that
 * line, which is exactly how the admin dashboard came to report 994 orders for
 * a week while the real total climbed past 1190.
 *
 * `fetchAllRows` walks the result set a page at a time until it is exhausted,
 * so callers get the whole thing.
 *
 * Two rules for callers:
 *
 *  1. **Always order by something unique** (add `.order("id")` as a final
 *     tiebreaker). Offset paging over a non-deterministic order lets Postgres
 *     return the same row on two pages and skip another entirely — silent
 *     duplicates and holes in the totals.
 *  2. **Only reach for this on tables that can outgrow 1000 rows.** A single
 *     `.select()` is one round trip; don't spend two on `categories`.
 *
 * Errors throw rather than resolve to a short list. A half-fetched result set
 * looks exactly like a real one to the caller, and these numbers are money —
 * failing into the admin error boundary is the honest outcome.
 */

/** PostgREST's `db-max-rows` on Supabase. Also the page size we request. */
export const SUPABASE_MAX_ROWS = 1000;

/** Runaway guard: 100 pages = 100k rows. Well past anything here, but a
 *  malformed `page()` that ignores `from` would otherwise spin forever. */
const MAX_PAGES = 100;

type PageResult = { data: unknown; error: { message: string } | null };

/**
 * @param page Builds one page of the query. Receives an inclusive row range to
 *   hand to `.range(from, to)`; a fresh builder must be constructed per call,
 *   since Supabase query builders are single-use.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult>
): Promise<T[]> {
  const rows: T[] = [];

  for (let i = 0; i < MAX_PAGES; i++) {
    const from = i * SUPABASE_MAX_ROWS;
    const { data, error } = await page(from, from + SUPABASE_MAX_ROWS - 1);
    if (error) throw new Error(`fetchAllRows: ${error.message}`);

    const batch = (data as T[] | null) ?? [];
    for (const row of batch) rows.push(row);

    // A short page is the last page.
    if (batch.length < SUPABASE_MAX_ROWS) return rows;
  }

  return rows;
}
