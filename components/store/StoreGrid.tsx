"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, ShoppingCart } from "lucide-react";
import { CategoryFilter } from "./CategoryFilter";
import { ProductCard } from "./ProductCard";
import { useCart } from "@/lib/hooks/useCart";
import { formatCurrency } from "@/lib/utils/formatters";
import { productInCategory } from "@/lib/utils/categories";
import type { Category, Product } from "@/lib/types";

interface Props {
  categories: Category[];
  products: Product[];
  currency?: string;
}

/** Everything a shopper might reasonably type to find a product. */
function searchText(p: Product) {
  return [p.name, p.description, p.details?.brand, p.category?.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function StoreGrid({ categories, products, currency = "₹" }: Props) {
  const [active, setActive] = useState("all");
  const [query, setQuery] = useState("");
  // Select the derived numbers, not the `items` array itself: the array gets a
  // new identity on every cart mutation, which re-rendered this whole grid (and
  // every ProductCard in it) even when the checkout bar didn't change.
  const count = useCart((s) => (s.hydrated ? s.items.reduce((n, i) => n + i.quantity, 0) : 0));
  const subtotal = useCart((s) =>
    s.hydrated ? s.items.reduce((n, i) => n + i.price * i.quantity, 0) : 0
  );

  const q = query.trim().toLowerCase();

  // A search looks across the whole shop — narrowing it to the open category
  // would hide the very item the shopper typed the name of.
  const filtered = useMemo(() => {
    if (q) {
      const terms = q.split(/\s+/);
      return products.filter((p) => {
        const haystack = searchText(p);
        return terms.every((t) => haystack.includes(t));
      });
    }
    // A product can sit in several categories, so a chip shows everything that
    // lists it — not only the ones whose primary category it is.
    return active === "all" ? products : products.filter((p) => productInCategory(p, active));
  }, [q, active, products]);

  return (
    <div>
      <div className="sticky top-16 z-30 border-b border-white/10 bg-black py-3">
        <div className="mx-auto max-w-5xl px-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                // Searching spans the whole shop, so drop back to "All" rather
                // than leaving a category chip lit that isn't filtering anything.
                setActive("all");
              }}
              placeholder="Search snacks, drinks…"
              aria-label="Search products"
              autoComplete="off"
              enterKeyHint="search"
              className="h-11 w-full appearance-none rounded-full border border-white/15 bg-white/5 pl-10 pr-10 text-sm text-white placeholder:text-white/40 focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/30 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mx-auto mt-2 flex max-w-5xl justify-center px-4">
          <CategoryFilter
            categories={categories}
            active={active}
            onChange={(id) => {
              setActive(id);
              setQuery("");
            }}
          />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-4">
        {filtered.length === 0 ? (
          <div className="py-20 text-center text-stone-400">
            {q ? `No products match “${query.trim()}”.` : "No products in this category yet."}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} currency={currency} />
            ))}
          </div>
        )}
      </div>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:pb-4">
          <Link
            href="/cart"
            className="mx-auto flex max-w-lg items-center justify-between rounded-2xl bg-lime-400 px-5 py-3.5 text-stone-950 shadow-[0_18px_40px_-12px_rgba(248,203,70,0.7)] ring-1 ring-black/5 transition hover:bg-lime-300"
          >
            <div className="flex items-center gap-2 text-sm font-bold">
              <ShoppingCart className="h-5 w-5" />
              {count} item{count > 1 ? "s" : ""} • {formatCurrency(subtotal, currency)}
            </div>
            <span className="flex items-center gap-1 text-sm font-extrabold">Checkout →</span>
          </Link>
        </div>
      )}
    </div>
  );
}
