"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, Tags, X, SlidersHorizontal } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { chunked } from "@/lib/utils/batch";
import { formatCurrency } from "@/lib/utils/formatters";
import { imagePositionStyle } from "@/lib/utils/image";
import {
  ancestorIds,
  orderCategoryTree,
  productCategoryIds,
  productInCategory,
} from "@/lib/utils/categories";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MultiSelect, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TableToolbar, SortHeader } from "@/components/admin/TableControls";
import { BulkEditProductsModal } from "@/components/admin/BulkEditProductsModal";
import { CategoryCreateModal } from "@/components/admin/CategoryCreateModal";
import { TableScroll, tableCardClass, stickyHead } from "@/components/admin/TableShell";
import { useTableControls, byText, byNum, byDate } from "@/lib/hooks/useTableControls";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import type { Category, Product } from "@/lib/types";

function stockColorByVal(p: Product, value: string | undefined) {
  const n = parseInt(value ?? "") || 0;
  if (n <= 0) return "text-red-400";
  if (n <= p.minimum_stock) return "text-yellow-400";
  return "text-white";
}

export function ProductsTable({
  products,
  categories,
  currency,
}: {
  products: Product[];
  categories: Category[];
  currency: string;
}) {
  const router = useRouter();
  const [cat, setCat] = usePersistentState("admin:products:cat", "all");
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // ---- Bulk categorise ----
  // Selection is kept as an ordered id list, deliberately *outside* the search
  // and category filters: picking three snacks, searching something else and
  // picking two more has to add up to five, so the selected rows are pinned
  // above the filtered list rather than living inside it.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCats, setBulkCats] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState<"add" | "replace">("add");
  const [applying, setApplying] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [bulkEdit, setBulkEdit] = useState(false);
  // Non-null while the quick-create modal is open, holding the typed name.
  const [newCategory, setNewCategory] = useState<string | null>(null);

  // Inline stock editing — instant local update, debounced background save.
  const [stocks, setStocks] = useState<Record<string, string>>(() =>
    Object.fromEntries(products.map((p) => [p.id, String(p.current_stock)]))
  );
  const [savedId, setSavedId] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Edits not yet persisted (id -> value). Used to flush on blur / app-background
  // so mobile saves don't get lost when the keyboard closes or the tab hides.
  const dirty = useRef<Record<string, string>>({});

  async function saveStock(id: string) {
    const value = dirty.current[id];
    if (value === undefined) return;
    delete dirty.current[id];
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .update({ current_stock: parseInt(value) || 0 })
      .eq("id", id);
    if (error) {
      dirty.current[id] = value; // keep it pending so a later flush retries
      return toast.error(`Stock: ${error.message}`);
    }
    setSavedId(id);
    setTimeout(() => setSavedId((cur) => (cur === id ? null : cur)), 1200);
  }

  function onStockChange(id: string, value: string) {
    const clean = value.replace(/[^0-9]/g, "");
    setStocks((s) => ({ ...s, [id]: clean }));
    dirty.current[id] = clean;
    if (timers.current[id]) clearTimeout(timers.current[id]);
    // Auto-save shortly after typing stops (well within 2.5s).
    timers.current[id] = setTimeout(() => saveStock(id), 800);
  }

  // Re-sync the inputs whenever the server rows change — a bulk edit, a
  // purchase, another admin. Fields with an unsaved keystroke are skipped, so
  // a refresh mid-typing can't yank the value out from under the cursor.
  useEffect(() => {
    setStocks((cur) => {
      let changed = false;
      const next = { ...cur };
      for (const p of products) {
        if (dirty.current[p.id] !== undefined) continue;
        const server = String(p.current_stock);
        if (next[p.id] !== server) {
          next[p.id] = server;
          changed = true;
        }
      }
      return changed ? next : cur;
    });
  }, [products]);

  // Safety net for mobile: persist any pending edits when the field loses focus
  // (keyboard closes) or the page is hidden/backgrounded.
  useEffect(() => {
    const flush = () => Object.keys(dirty.current).forEach((id) => saveStock(id));
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  const byCat = cat === "all" ? products : products.filter((p) => productInCategory(p, cat));
  const ctl = useTableControls(byCat, {
    searchFields: (p) => [p.name],
    dateField: (p) => p.created_at,
    sorters: {
      name: byText((p) => p.name),
      cost: byNum((p) => p.cost_price),
      price: byNum((p) => p.selling_price),
      stock: byNum((p) => p.current_stock),
      created: byDate((p) => p.created_at),
    },
    initialSort: "name",
    initialDir: "asc",
    persistKey: "admin:products:ctl",
  });

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  // Resolved against the current product list, so an id left over from a
  // deleted product simply drops out instead of needing to be pruned.
  const pinned = useMemo(
    () => selectedIds.map((id) => productById.get(id)).filter((p): p is Product => !!p),
    [selectedIds, productById]
  );
  // Selected rows are shown once, in the pinned block — never twice.
  const rest = useMemo(() => ctl.rows.filter((p) => !selectedSet.has(p.id)), [ctl.rows, selectedSet]);

  const { page, setPage, perPage, setPerPage, total, totalPages, pageItems } = usePagination(
    rest,
    20,
    "admin:products:pg"
  );

  const allFilteredSelected = ctl.rows.length > 0 && rest.length === 0;
  const someFilteredSelected = !allFilteredSelected && rest.length < ctl.rows.length;

  function toggleOne(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  /** Header checkbox: take (or drop) everything the current filters show. */
  function toggleAllFiltered() {
    const ids = ctl.rows.map((p) => p.id);
    setSelectedIds((prev) => {
      const have = new Set(prev);
      if (ids.every((id) => have.has(id))) {
        const drop = new Set(ids);
        return prev.filter((id) => !drop.has(id));
      }
      return [...prev, ...ids.filter((id) => !have.has(id))];
    });
  }

  const parentById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.parent_id])),
    [categories]
  );

  /**
   * Picking a sub-category implies its parent (Chips is a kind of Snacks), the
   * same rule the product form and the database trigger apply — mirrored here
   * so the bar shows what will actually be written.
   */
  function pickBulkCats(next: string[]) {
    setBulkCats([...new Set(next.flatMap((id) => [id, ...ancestorIds(id, parentById)]))]);
  }

  async function applyCategories() {
    const ids = pinned.map((p) => p.id);
    if (!ids.length || !bulkCats.length) return;
    setApplying(true);
    const supabase = createClient();
    const keep = `(${bulkCats.map((id) => `"${id}"`).join(",")})`;
    try {
      // Replace drops the memberships that aren't in the new set first; the ones
      // it keeps are never momentarily missing (the store filters off these rows).
      if (bulkMode === "replace") {
        const { error } = await supabase
          .from("product_categories")
          .delete()
          .in("product_id", ids)
          .not("category_id", "in", keep);
        if (error) throw error;
      }

      const rows = ids.flatMap((product_id) =>
        bulkCats.map((category_id) => ({ product_id, category_id }))
      );
      for (const batch of chunked(rows, 500)) {
        const { error } = await supabase
          .from("product_categories")
          .upsert(batch, { onConflict: "product_id,category_id" });
        if (error) throw error;
      }

      // `category_id` is the primary category — the row label and the one sales
      // reports attribute revenue to. Replace sets it outright; add only fills
      // it in where there isn't one, so tagging never quietly re-attributes a
      // product's existing revenue to a different category.
      const update = supabase
        .from("products")
        .update({ category_id: bulkCats[0], updated_at: new Date().toISOString() })
        .in("id", ids);
      const { error } = bulkMode === "replace" ? await update : await update.is("category_id", null);
      if (error) throw error;

      toast.success(
        `${bulkMode === "replace" ? "Recategorised" : "Categorised"} ${ids.length} product${ids.length === 1 ? "" : "s"}.`
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update categories.");
    } finally {
      setApplying(false);
      setConfirmReplace(false);
    }
  }

  async function toggleActive(p: Product) {
    setBusy(p.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .update({ is_active: !p.is_active })
      .eq("id", p.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(p.is_active ? "Product hidden" : "Product activated");
    router.refresh();
  }

  async function removeConfirmed() {
    if (!deleteTarget) return;
    const p = deleteTarget;
    setBusy(p.id);
    const supabase = createClient();
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    setBusy(null);
    setDeleteTarget(null);
    if (error) return toast.error(error.message);
    toast.success("Product deleted");
    router.refresh();
  }

  function renderRow(p: Product, isPinned: boolean) {
    const category = categories.find((c) => c.id === p.category_id);
    // The primary category is the label; the rest are a "+N" hint so
    // the row stays one line however many a product belongs to.
    const extra = productCategoryIds(p).length - 1;
    return (
      <tr
        key={p.id}
        onClick={() => router.push(`/admin/products/${p.id}`)}
        className={`cursor-pointer border-b border-black/10 last:border-0 hover:bg-yellow-400/10 dark:border-white/10 ${
          isPinned ? "bg-yellow-400/[0.07]" : ""
        }`}
      >
        <td className="p-3" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selectedSet.has(p.id)}
            onChange={() => toggleOne(p.id)}
            aria-label={`Select ${p.name}`}
            className="h-4 w-4 cursor-pointer accent-yellow-400"
          />
        </td>
        <td className="p-3">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-8 shrink-0 overflow-hidden rounded-md bg-black/5 dark:bg-white/10">
              {p.image_url ? (
                <Image src={p.image_url} alt={p.name} fill style={imagePositionStyle(p.details)} sizes="32px" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm">{category?.icon ?? "📦"}</div>
              )}
            </div>
            <span className="font-medium text-black dark:text-white">{p.name}</span>
          </div>
        </td>
        <td className="p-3">
          {category ? `${category.icon} ${category.name}` : "—"}
          {extra > 0 && (
            <span
              className="ml-1.5 rounded bg-black/10 px-1.5 py-0.5 text-[11px] font-medium text-black/60 dark:bg-white/10 dark:text-white/60"
              title={productCategoryIds(p)
                .map((id) => categories.find((c) => c.id === id)?.name)
                .filter(Boolean)
                .join(", ")}
            >
              +{extra}
            </span>
          )}
        </td>
        <td className="num p-3">{formatCurrency(p.cost_price, currency)}</td>
        <td className="num p-3">{formatCurrency(p.selling_price, currency)}</td>
        <td className="p-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            <input
              value={stocks[p.id] ?? ""}
              onChange={(e) => onStockChange(p.id, e.target.value)}
              onBlur={() => saveStock(p.id)}
              inputMode="numeric"
              aria-label={`Stock for ${p.name}`}
              className={`w-16 rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm font-bold focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 dark:border-white/15 ${stockColorByVal(p, stocks[p.id])}`}
            />
            {savedId === p.id && <Check className="h-4 w-4 text-green-500" />}
          </div>
        </td>
        <td className="p-3" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => toggleActive(p)}
            disabled={busy === p.id}
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              p.is_active
                ? "border border-yellow-400 bg-yellow-400 text-black"
                : "border border-black/15 bg-transparent text-black/50 dark:border-white/15 dark:text-white/50"
            }`}
          >
            {p.is_active ? "Active" : "Hidden"}
          </button>
        </td>
        <td className="p-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-end gap-1">
            <Link
              href={`/admin/products/${p.id}`}
              className="rounded-md p-1.5 text-black/50 hover:bg-yellow-400 hover:text-black dark:text-white/50"
            >
              <Pencil className="h-4 w-4" />
            </Link>
            <button
              onClick={() => setDeleteTarget(p)}
              disabled={busy === p.id}
              className="rounded-md p-1.5 text-black/50 hover:bg-yellow-400 hover:text-black dark:text-white/50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className={tableCardClass}>
      <div className="shrink-0">
        <TableToolbar
          query={ctl.query}
          onQuery={ctl.setQuery}
          placeholder="Search products…"
          from={ctl.from}
          to={ctl.to}
          onFrom={ctl.setFrom}
          onTo={ctl.setTo}
          hasDateFilter={ctl.hasDateFilter}
          onClearDates={ctl.clearDates}
        >
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-40 lg:w-48">
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </Select>
        </TableToolbar>
      </div>

      {/* Bulk bar. Sits above the scroll area so the picked-up selection and its
          actions stay put while the list underneath is re-searched. */}
      {pinned.length > 0 && (
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-yellow-400/40 bg-yellow-400/10 p-2">
          <span className="inline-flex items-center gap-1.5 px-1 text-sm font-semibold text-black dark:text-white">
            <Tags className="h-4 w-4" />
            {pinned.length} selected
          </span>
          <MultiSelect
            className="min-w-[12rem] flex-1 sm:max-w-[18rem]"
            values={bulkCats}
            onChange={pickBulkCats}
            placeholder="Pick categories"
            searchable
            options={orderCategoryTree(categories).map((c) => ({
              value: c.id,
              label: `${c.parent_id ? "↳ " : ""}${c.icon} ${c.name}`,
              text: c.name,
            }))}
            hint="Picking a sub-category adds its parent too. The first pick is the primary category — the one sales reports use."
            onCreate={setNewCategory}
            createLabel="New category"
          />
          <div className="flex overflow-hidden rounded-lg border border-black/15 dark:border-white/15">
            {(["add", "replace"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setBulkMode(m)}
                className={`px-3 py-1.5 text-xs font-semibold capitalize ${
                  bulkMode === m
                    ? "bg-yellow-400 text-black"
                    : "text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            disabled={bulkCats.length === 0}
            loading={applying}
            onClick={() => (bulkMode === "replace" ? setConfirmReplace(true) : applyCategories())}
          >
            Apply
          </Button>
          <Button size="sm" variant="outline" onClick={() => setBulkEdit(true)}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> Edit details
          </Button>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      )}

      <TableScroll>
        <table className="w-full min-w-[52rem] text-sm">
          <thead className={stickyHead}>
            <tr className="border-b border-black/10 text-left text-xs text-black/50 dark:border-white/10 dark:text-white/50">
              <th className="w-10 p-3">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someFilteredSelected;
                  }}
                  onChange={toggleAllFiltered}
                  disabled={ctl.rows.length === 0}
                  aria-label="Select every product matching the current filters"
                  className="h-4 w-4 cursor-pointer accent-yellow-400"
                />
              </th>
              <SortHeader label="Product" sortKey="name" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} />
              <th className="p-3">Category</th>
              <SortHeader label="Cost" sortKey="cost" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} defaultDir="desc" />
              <SortHeader label="Price" sortKey="price" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} defaultDir="desc" />
              <SortHeader label="Stock" sortKey="stock" activeKey={ctl.sortKey} dir={ctl.dir} onSort={ctl.toggleSort} defaultDir="desc" />
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-black/75 dark:text-white/75">
            {pinned.length === 0 && pageItems.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-black/50 dark:text-white/50">
                  No products found.
                </td>
              </tr>
            )}
            {pinned.map((p) => renderRow(p, true))}
            {pinned.length > 0 && pageItems.length > 0 && (
              <tr aria-hidden>
                <td colSpan={8} className="border-b-2 border-yellow-400/40 p-0" />
              </tr>
            )}
            {pageItems.map((p) => renderRow(p, false))}
          </tbody>
        </table>
      </TableScroll>
      <div className="shrink-0">
        <Pagination page={page} totalPages={totalPages} perPage={perPage} total={total} onPage={setPage} onPerPage={setPerPage} />
      </div>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete product"
        description={`Delete "${deleteTarget?.name ?? "this product"}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={!!deleteTarget && busy === deleteTarget.id}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeConfirmed}
      />
      <CategoryCreateModal
        open={newCategory !== null}
        initialName={newCategory ?? ""}
        categories={categories}
        onClose={() => setNewCategory(null)}
        onCreated={(c) => {
          setNewCategory(null);
          // The new row reaches `categories` only on the refresh below, so its
          // parent is named here rather than looked up by pickBulkCats. The new
          // category goes first so it, not the parent, becomes the primary.
          pickBulkCats([...bulkCats, c.id, ...(c.parent_id ? [c.parent_id] : [])]);
          router.refresh();
        }}
      />
      <BulkEditProductsModal
        open={bulkEdit}
        products={pinned}
        currency={currency}
        onClose={() => setBulkEdit(false)}
        onDone={(ok) => {
          router.refresh();
          if (ok) setBulkEdit(false);
        }}
      />
      <ConfirmDialog
        open={confirmReplace}
        title="Replace categories"
        description={`Every other category comes off ${pinned.length} product${pinned.length === 1 ? "" : "s"}, and their primary category — the one sales reports use — becomes the first one you picked.`}
        confirmLabel="Replace"
        loading={applying}
        onCancel={() => setConfirmReplace(false)}
        onConfirm={applyCategories}
      />
    </div>
  );
}
