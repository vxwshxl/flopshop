import { cn } from "@/lib/utils/cn";

/**
 * Shared layout primitives for admin table pages. The goal: the page header,
 * search/filter toolbar and table header stay put while only the table rows
 * scroll. Compose them as:
 *
 *   <div className={tablePageClass}>
 *     <PageHeader … />
 *     <div className={tableCardClass}>
 *       <div className="shrink-0"><TableToolbar … /></div>
 *       <TableScroll>
 *         <table><thead className={stickyHead}>…</thead><tbody>…</tbody></table>
 *       </TableScroll>
 *       <div className="shrink-0"><Pagination … /></div>
 *     </div>
 *   </div>
 */

/** Page root: locks to the viewport below the navbar so the page itself never scrolls. */
export const tablePageClass = "flex h-[calc(100dvh-6rem)] flex-col md:h-[calc(100dvh-8rem)]";

/** Glass card that fills the remaining height and lays out toolbar / scroll / pagination. */
export const tableCardClass = "glass flex min-h-0 flex-1 flex-col rounded-2xl p-4";

/** Sticky <thead>. Needs an opaque cell background so rows scroll cleanly underneath. */
export const stickyHead = "sticky top-0 z-10 [&_th]:bg-white dark:[&_th]:bg-black";

/** Bordered, scrollable region for the <table>; grows to fill the card. */
export function TableScroll({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-auto rounded-lg border border-black/15 bg-white dark:border-white/15 dark:bg-black",
        className
      )}
    >
      {children}
    </div>
  );
}
