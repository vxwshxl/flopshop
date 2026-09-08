"use client";

import { ToggleGroup, type ToggleOption } from "@/components/ui/toggle-group";
import { categoryTree } from "@/lib/utils/categories";
import type { Category } from "@/lib/types";

interface Props {
  categories: Category[];
  active: string; // "all" or category id
  onChange: (id: string) => void;
}

/**
 * Two rows, revealed in order: the shop's sections up top as solid primary
 * boxes, and — only once a section with sub-categories is open — its shelves
 * beneath it. A flat row put Chips, Bread and Chocolates next to Drinks and
 * Noodles as if they were peers, which pushed the real sections off the edge
 * of the screen and made the row something to scroll rather than to read.
 */
export function CategoryFilter({ categories, active, onChange }: Props) {
  const tree = categoryTree(categories);

  // Which section is open: the active category itself if it's top level,
  // otherwise the parent it was picked from.
  const open = tree.find((g) => g.root.id === active || g.children.some((c) => c.id === active));

  const sections: ToggleOption[] = [
    { value: "all", label: <><span>🛍️</span> All</> },
    ...tree.map(({ root }) => ({
      value: root.id,
      label: (
        <>
          <span>{root.icon}</span> {root.name}
        </>
      ),
    })),
  ];

  // "All Snacks" leads, so narrowing to a shelf is always reversible without
  // going back up to the section row.
  const shelves: ToggleOption[] | null = open?.children.length
    ? [
        { value: open.root.id, label: <>All {open.root.name}</> },
        ...open.children.map((c) => ({
          value: c.id,
          label: (
            <>
              <span>{c.icon}</span> {c.name}
            </>
          ),
        })),
      ]
    : null;

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <ToggleGroup
        options={sections}
        value={open?.root.id ?? active}
        onChange={onChange}
        variant="solid"
        scrollArrows
      />
      {open && shelves && (
        <ToggleGroup
          key={open.root.id}
          options={shelves}
          value={active}
          onChange={onChange}
          className="subrow-in"
          scrollArrows
        />
      )}
    </div>
  );
}
