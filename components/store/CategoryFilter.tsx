"use client";

import { ToggleGroup, type ToggleOption } from "@/components/ui/toggle-group";
import type { Category } from "@/lib/types";

interface Props {
  categories: Category[];
  active: string; // "all" or category id
  onChange: (id: string) => void;
}

export function CategoryFilter({ categories, active, onChange }: Props) {
  const options: ToggleOption[] = [
    { value: "all", label: <><span>🛍️</span> All</> },
    ...categories.map((c) => ({
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
