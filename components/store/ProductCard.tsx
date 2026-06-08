"use client";

import { useState } from "react";
import Image from "next/image";
import { Minus, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { useCart } from "@/lib/hooks/useCart";
import { formatCurrency } from "@/lib/utils/formatters";
import { ProductDetailModal } from "./ProductDetailModal";
import type { Product } from "@/lib/types";

export function ProductCard({ product, currency = "₹" }: { product: Product; currency?: string }) {
  const qty = useCart((s) => (s.hydrated ? s.items.find((i) => i.id === product.id)?.quantity ?? 0 : 0));
  const addItem = useCart((s) => s.addItem);
  const increment = useCart((s) => s.increment);
  const decrement = useCart((s) => s.decrement);
  const [detailOpen, setDetailOpen] = useState(false);

  const outOfStock = product.current_stock <= 0;

  return (
    <div className="glass flex flex-col overflow-hidden rounded-2xl transition hover:-translate-y-0.5 hover:shadow-lg">
      <button
        type="button"
        onClick={() => setDetailOpen(true)}
        className="relative aspect-square w-full cursor-pointer bg-white/50 text-left dark:bg-white/5"
        aria-label={`View ${product.name} details`}
      >
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, 200px"
            className="object-contain p-2"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">
            {product.category?.icon ?? "🍫"}
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/75 dark:bg-stone-950/70">
            <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
              Out of Stock
            </span>
          </div>
        )}
      </button>

      <ProductDetailModal
        product={product}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        currency={currency}
      />

      <div className="flex flex-1 flex-col p-3">
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="line-clamp-2 text-left text-xs font-semibold uppercase tracking-wide text-white transition hover:text-lime-400"
        >
          {product.name}
        </button>
        {product.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-stone-500 dark:text-stone-400">{product.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-base font-extrabold text-stone-950 dark:text-white">
            {formatCurrency(product.selling_price, currency)}
          </span>

          {outOfStock ? (
            <button
              disabled
              className="cursor-not-allowed rounded-full border border-stone-200 px-4 py-1.5 text-xs font-bold text-stone-300 dark:border-stone-700 dark:text-stone-600"
            >
              ADD
            </button>
          ) : qty === 0 ? (
            <button
              onClick={() => {
                addItem(product);
                toast.success(`${product.name} added`);
              }}
              className="rounded-full bg-lime-400 px-5 py-1.5 text-xs font-extrabold text-stone-900 shadow-sm ring-1 ring-black/5 transition hover:bg-lime-300 active:scale-95"
            >
              ADD
            </button>
          ) : (
            <div className="glass-lens flex items-center gap-1 rounded-full text-stone-900 dark:text-white">
              <button
                onClick={() => decrement(product.id)}
                className="grid h-8 w-8 place-items-center rounded-full transition hover:text-lime-700 dark:hover:text-lime-300"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-5 text-center text-sm font-extrabold">{qty}</span>
              <button
                onClick={() => increment(product.id)}
                disabled={qty >= product.current_stock}
                className="grid h-8 w-8 place-items-center rounded-full transition hover:text-lime-700 disabled:opacity-40 dark:hover:text-lime-300"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
