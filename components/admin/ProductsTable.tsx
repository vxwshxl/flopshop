"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Check } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/formatters";
import { imagePositionStyle } from "@/lib/utils/image";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/input";
import { TableToolbar, SortHeader } from "@/components/admin/TableControls";
import { TableScroll, tableCardClass, stickyHead } from "@/components/admin/TableShell";
import { useTableControls, byText, byNum, byDate } from "@/lib/hooks/useTableControls";
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
  const [cat, setCat] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

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

  const byCat = cat === "all" ? products : products.filter((p) => p.category_id === cat);
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
  });
  const { page, setPage, perPage, setPerPage, total, totalPages, pageItems } = usePagination(ctl.rows);

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
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-48">
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </Select>
          <Link href="/admin/products/new">
            <Button variant="dark">
              <Plus className="h-4 w-4" /> Add product
            </Button>
          </Link>
        </TableToolbar>
      </div>

      <TableScroll>
        <table className="w-full text-sm">
          <thead className={stickyHead}>
            <tr className="border-b border-black/10 text-left text-xs text-black/50 dark:border-white/10 dark:text-white/50">
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
            {ctl.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-black/50 dark:text-white/50">
                  No products found.
                </td>
              </tr>
            )}
            {pageItems.map((p) => {
              const category = categories.find((c) => c.id === p.category_id);
              return (
                <tr key={p.id} className="border-b border-black/10 last:border-0 hover:bg-yellow-400/10 dark:border-white/10">
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
                  <td className="p-3">{category ? `${category.icon} ${category.name}` : "—"}</td>
                  <td className="p-3">{formatCurrency(p.cost_price, currency)}</td>
                  <td className="p-3">{formatCurrency(p.selling_price, currency)}</td>
                  <td className="p-3">
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
                  <td className="p-3">
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
                  <td className="p-3">
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
            })}
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
    </div>
  );
}
