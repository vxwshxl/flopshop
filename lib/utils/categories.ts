import type { Product } from "@/lib/types";

/**
 * Every category a product belongs to, primary first.
 *
 * The join rows are the full set, but a product saved before the join table
 * existed (or fetched by a query that didn't join it) only has `category_id` —
 * fall back to that so nothing silently drops out of its own category.
 */
export function productCategoryIds(
  p: Pick<Product, "category_id" | "product_categories">
): string[] {
  const joined = (p.product_categories ?? []).map((r) => r.category_id);
  const all = p.category_id ? [p.category_id, ...joined] : joined;
  return [...new Set(all)];
}

/** Whether a product should appear under `categoryId`. */
export function productInCategory(
  p: Pick<Product, "category_id" | "product_categories">,
  categoryId: string
): boolean {
  return productCategoryIds(p).includes(categoryId);
}

/**
 * The top-level category a category rolls up into — Chips → Snacks, Snacks →
 * Snacks. Reports use this so a sale of a Snickers filed under "Chocolates and
 * Sweets" still counts towards Snacks rather than splintering the breakdown.
 *
 * Walks at most 10 links so a mis-set parent can't loop forever.
 */
export function rootCategoryId(
  id: string,
  parentById: Map<string, string | null>
): string {
  let current = id;
  for (let i = 0; i < 10; i++) {
    const parent = parentById.get(current);
    if (!parent || parent === current) break;
    current = parent;
  }
  return current;
}

/** Every ancestor of a category, nearest first (excludes the category itself). */
export function ancestorIds(
  id: string,
  parentById: Map<string, string | null>
): string[] {
  const out: string[] = [];
  let current = id;
  for (let i = 0; i < 10; i++) {
    const parent = parentById.get(current);
    if (!parent || parent === current || out.includes(parent)) break;
    out.push(parent);
    current = parent;
  }
  return out;
}

/**
 * Reorders a flat category list into tree order: each top-level category in its
 * own sort order, immediately followed by its children. A flat `sort_order`
 * puts Chips (5) four rows below Snacks (1), which reads as unrelated — this
 * pulls them together so the nesting is visible without a tree widget.
 *
 * Orphans (a parent that's missing or inactive) fall back to the top level so
 * nothing silently disappears from a picker.
 */
export function orderCategoryTree<T extends { id: string; parent_id: string | null; sort_order: number }>(
  categories: T[]
): T[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const bySort = (a: T, b: T) => a.sort_order - b.sort_order || a.id.localeCompare(b.id);
  const roots = categories.filter((c) => !c.parent_id || !byId.has(c.parent_id)).sort(bySort);
  const childrenOf = (id: string) => categories.filter((c) => c.parent_id === id).sort(bySort);
  return roots.flatMap((root) => [root, ...childrenOf(root.id)]);
}

/**
 * The same tree, grouped: each top-level category with its children attached.
 *
 * The storefront row shows only the roots, and reveals a root's children once
 * it's picked — a shopper chooses "Snacks" before "Chips" instead of being
 * handed every shelf in the shop at once.
 *
 * Orphans (parent missing or inactive) count as top level, matching
 * `orderCategoryTree`, so nothing silently drops out of the row.
 */
export function categoryTree<T extends { id: string; parent_id: string | null; sort_order: number }>(
  categories: T[]
): { root: T; children: T[] }[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const bySort = (a: T, b: T) => a.sort_order - b.sort_order || a.id.localeCompare(b.id);
  return categories
    .filter((c) => !c.parent_id || !byId.has(c.parent_id))
    .sort(bySort)
    .map((root) => ({
      root,
      children: categories.filter((c) => c.parent_id === root.id).sort(bySort),
    }));
}
