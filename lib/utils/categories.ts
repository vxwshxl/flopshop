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
