"use client";

import Image from "next/image";
import { Minus, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { Modal } from "@/components/ui/modal";
import { useSettings } from "@/lib/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/hooks/useCart";
import { formatCurrency } from "@/lib/utils/formatters";
import { imagePositionStyle } from "@/lib/utils/image";
import type { Product } from "@/lib/types";

export function ProductDetailModal({
  product,
  open,
  onClose,
  currency = "₹",
}: {
  product: Product;
  open: boolean;
  onClose: () => void;
  currency?: string;
}) {
  const qty = useCart((s) => (s.hydrated ? s.items.find((i) => i.id === product.id)?.quantity ?? 0 : 0));
  const addItem = useCart((s) => s.addItem);
  const increment = useCart((s) => s.increment);
  const decrement = useCart((s) => s.decrement);
  const { isOpen } = useSettings();

  const d = product.details;
  const outOfStock = product.current_stock <= 0;

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <div className="relative mx-auto mb-4 aspect-[4/5] w-full max-w-[260px] overflow-hidden rounded-lg bg-stone-50 dark:bg-stone-800">
        {product.image_url ? (
          <Image src={product.image_url} alt={product.name} fill style={imagePositionStyle(product.details)} sizes="260px" />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl">
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
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-stone-950 dark:text-white">{product.name}</h2>
          {d?.brand && <p className="text-sm text-stone-500 dark:text-stone-400">{[d.brand, d.quantity].filter(Boolean).join(" · ")}</p>}
        </div>
        <span className="shrink-0 text-xl font-extrabold text-stone-950 dark:text-white">
          {formatCurrency(product.selling_price, currency)}
        </span>
      </div>

      {product.description && <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{product.description}</p>}

      {product.category && (
        <span
          className="mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: product.category.color }}
        >
          {product.category.icon} {product.category.name}
        </span>
      )}

      <div className="mt-5">
        {outOfStock ? (
          <Button disabled className="w-full" variant="secondary">
            Out of stock
          </Button>
        ) : qty === 0 ? (
          <Button
            className="w-full"
            size="lg"
            onClick={() => {
              if (!isOpen) return toast.error("The shop is currently closed.");
              addItem(product);
              // Sit just above the fixed bottom cart/checkout bar for clarity.
              toast.success(`${product.name} added`, { position: "bottom-center", style: { marginBottom: "4.75rem" } });
            }}
            disabled={!isOpen}
          >
            Add to cart · {formatCurrency(product.selling_price, currency)}
          </Button>
        ) : (
          <div className="flex items-center justify-between rounded-lg bg-lime-500 px-2 text-stone-950">
            <button onClick={() => decrement(product.id)} className="grid h-11 w-11 place-items-center">
              <Minus className="h-4 w-4" />
            </button>
            <span className="text-base font-bold">{qty} in cart</span>
            <button
              onClick={() => increment(product.id)}
              disabled={qty >= product.current_stock}
              className="grid h-11 w-11 place-items-center disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
