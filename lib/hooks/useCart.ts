"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, OrderType, Product } from "@/lib/types";

interface CartState {
  items: CartItem[];
  orderType: OrderType;
  hydrated: boolean;
  addItem: (product: Product) => void;
  removeItem: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  increment: (id: string) => void;
  decrement: (id: string) => void;
  clear: () => void;
  setOrderType: (t: OrderType) => void;
  totalItems: () => number;
  subtotal: () => number;
  getQuantity: (id: string) => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      orderType: "pickup",
      hydrated: false,

      addItem: (product) => {
        const items = get().items;
        const existing = items.find((i) => i.id === product.id);
        const max = product.current_stock;
        if (existing) {
          if (existing.quantity >= max) return;
          set({
            items: items.map((i) =>
              i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
            ),
          });
        } else {
          if (max <= 0) return;
          set({
            items: [
              ...items,
              {
                id: product.id,
                name: product.name,
                price: Number(product.selling_price),
                image_url: product.image_url,
                current_stock: product.current_stock,
                quantity: 1,
              },
            ],
          });
        }
      },

      removeItem: (id) => set({ items: get().items.filter((i) => i.id !== id) }),

      setQuantity: (id, quantity) => {
        if (quantity <= 0) {
          set({ items: get().items.filter((i) => i.id !== id) });
          return;
        }
        set({
          items: get().items.map((i) =>
            i.id === id ? { ...i, quantity: Math.min(quantity, i.current_stock) } : i
          ),
        });
      },

      increment: (id) => {
        set({
          items: get().items.map((i) =>
            i.id === id && i.quantity < i.current_stock
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        });
      },

      decrement: (id) => {
        const item = get().items.find((i) => i.id === id);
        if (item && item.quantity <= 1) {
          set({ items: get().items.filter((i) => i.id !== id) });
        } else {
          set({
            items: get().items.map((i) =>
              i.id === id ? { ...i, quantity: i.quantity - 1 } : i
            ),
          });
        }
      },

      clear: () => set({ items: [] }),
      setOrderType: (t) => set({ orderType: t }),

      totalItems: () => get().items.reduce((s, i) => s + i.quantity, 0),
      subtotal: () => get().items.reduce((s, i) => s + i.price * i.quantity, 0),
      getQuantity: (id) => get().items.find((i) => i.id === id)?.quantity ?? 0,
    }),
    {
      name: "flopshop-cart",
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    }
  )
);
