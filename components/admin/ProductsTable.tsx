"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Search } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/formatters";
import { Button } from "@/components/ui/button";
import type { Category, Product } from "@/lib/types";

function stockColor(p: Product) {
  if (p.current_stock <= 0) return "text-red-400";
  if (p.current_stock <= p.minimum_stock) return "text-amber-400";
  return "text-green-400";
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
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          (cat === "all" || p.category_id === cat) &&
          p.name.toLowerCase().includes(query.toLowerCase())
      ),
    [products, query, cat]
  );

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

  async function remove(p: Product) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    setBusy(p.id);
    const supabase = createClient();
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Product deleted");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="h-10 w-full rounded-lg border border-[#333] bg-[#1a1a1a] pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="h-10 rounded-lg border border-[#333] bg-[#1a1a1a] px-3 text-sm text-white focus:outline-none"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        <Link href="/admin/products/new">
          <Button variant="dark">
            <Plus className="h-4 w-4" /> Add product
          </Button>
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#222] bg-[#1a1a1a]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#222] text-left text-xs text-gray-500">
              <th className="p-3">Product</th>
              <th className="p-3">Category</th>
              <th className="p-3">Cost</th>
              <th className="p-3">Price</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  No products found.
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const category = categories.find((c) => c.id === p.category_id);
              return (
                <tr key={p.id} className="border-b border-[#222] last:border-0 hover:bg-white/5">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-[#0a0a0a]">
                        {p.image_url ? (
                          <Image src={p.image_url} alt={p.name} fill className="object-cover" sizes="36px" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm">{category?.icon ?? "📦"}</div>
                        )}
                      </div>
                      <span className="font-medium text-white">{p.name}</span>
                    </div>
                  </td>
                  <td className="p-3">{category ? `${category.icon} ${category.name}` : "—"}</td>
                  <td className="p-3">{formatCurrency(p.cost_price, currency)}</td>
                  <td className="p-3">{formatCurrency(p.selling_price, currency)}</td>
                  <td className={`p-3 font-semibold ${stockColor(p)}`}>{p.current_stock}</td>
                  <td className="p-3">
                    <button
                      onClick={() => toggleActive(p)}
                      disabled={busy === p.id}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.is_active ? "bg-green-500/15 text-green-400" : "bg-gray-500/15 text-gray-400"
                      }`}
                    >
                      {p.is_active ? "Active" : "Hidden"}
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => remove(p)}
                        disabled={busy === p.id}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-white/10 hover:text-red-400"
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
      </div>
    </div>
  );
}
