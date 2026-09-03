"use client";

import { ToggleGroup, type ToggleOption } from "@/components/ui/toggle-group";
import { orderCategoryTree } from "@/lib/utils/categories";
import type { Category } from "@/lib/types";

interface Props {
  categories: Category[];
  active: string; // "all" or category id
  onChange: (id: string) => void;
}

export function CategoryFilter({ categories, active, onChange }: Props) {
  const options: ToggleOption[] = [
    { value: "all", label: <><span>🛍️</span> All</> },
    // Tree order keeps Chips / Bread / Chocolates next to Snacks rather than
    // scattered down the row by their flat sort_order.
    ...orderCategoryTree(categories).map((c) => ({
      value: c.id,
      label: (
        <>
          <span>{c.icon}</span> {c.name}
        </>
      ),
    })),
  ];

  return <ToggleGroup options={options} value={active} onChange={onChange} />;
}
