"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { CategoryFilter } from "./CategoryFilter";
import { ProductCard } from "./ProductCard";
import { useCart } from "@/lib/hooks/useCart";
import { formatCurrency } from "@/lib/utils/formatters";
import type { Category, Product } from "@/lib/types";

interface Props {
  categories: Category[];
  products: Product[];
  currency?: string;
}

export function StoreGrid({ categories, products, currency = "₹" }: Props) {
  const [active, setActive] = useState("all");
  const hydrated = useCart((s) => s.hydrated);
  const items = useCart((s) => s.items);

  const count = hydrated ? items.reduce((s, i) => s + i.quantity, 0) : 0;
  const subtotal = hydrated ? items.reduce((s, i) => s + i.price * i.quantity, 0) : 0;

  const filtered = useMemo(
    () => (active === "all" ? products : products.filter((p) => p.category_id === active)),
    [active, products]
  );

  return (
    <div className="pb-24">
      <div className="sticky top-14 z-30 border-b border-black/5 bg-[#fffdf5]/95 backdrop-blur dark:border-white/10 dark:bg-stone-950/90">
        <div className="mx-auto max-w-5xl px-4 py-2">
          <CategoryFilter categories={categories} active={active} onChange={setActive} />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-4">
        {filtered.length === 0 ? (
          <div className="py-20 text-center text-stone-400">No products in this category yet.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} currency={currency} />
            ))}
          </div>
        )}
      </div>

      {count > 0 && (
        <Link
          href="/cart"
          className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-5xl items-center justify-between bg-stone-950 px-5 py-3.5 text-white shadow-2xl sm:bottom-4 sm:mx-4 sm:rounded-lg md:mx-auto dark:bg-lime-400 dark:text-stone-950"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShoppingCart className="h-5 w-5" />
            {count} item{count > 1 ? "s" : ""} • {formatCurrency(subtotal, currency)}
          </div>
          <span className="flex items-center gap-1 text-sm font-bold">Checkout →</span>
        </Link>
      )}
    </div>
  );
}
