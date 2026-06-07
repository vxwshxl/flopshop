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
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md">
      <button
        type="button"
        onClick={() => setDetailOpen(true)}
        className="relative aspect-square w-full cursor-pointer bg-gray-50 text-left"
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
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
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
          className="line-clamp-2 text-left text-sm font-medium text-gray-900 hover:text-indigo-600"
        >
          {product.name}
        </button>
        {product.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-gray-400">{product.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-base font-bold text-gray-900">
            {formatCurrency(product.selling_price, currency)}
          </span>

          {outOfStock ? (
            <button
              disabled
              className="cursor-not-allowed rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-300"
            >
              ADD
            </button>
          ) : qty === 0 ? (
            <button
              onClick={() => {
                addItem(product);
                toast.success(`${product.name} added`);
              }}
              className="rounded-lg border border-indigo-600 px-4 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50"
            >
              ADD
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-indigo-600 text-white">
              <button
                onClick={() => decrement(product.id)}
                className="grid h-8 w-8 place-items-center rounded-l-lg hover:bg-indigo-700"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-4 text-center text-sm font-bold">{qty}</span>
              <button
                onClick={() => increment(product.id)}
                disabled={qty >= product.current_stock}
                className="grid h-8 w-8 place-items-center rounded-r-lg hover:bg-indigo-700 disabled:opacity-40"
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
