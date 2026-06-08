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
      <div className="sticky top-16 z-30 py-3">
        <div className="mx-auto flex max-w-5xl justify-center px-4">
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
