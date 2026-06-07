"use client";

import { cn } from "@/lib/utils/cn";
import type { Category } from "@/lib/types";

interface Props {
  categories: Category[];
  active: string; // "all" or category id
  onChange: (id: string) => void;
}

export function CategoryFilter({ categories, active, onChange }: Props) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
      <Pill label="All" icon="🛍️" active={active === "all"} onClick={() => onChange("all")} />
      {categories.map((c) => (
        <Pill
          key={c.id}
          label={c.name}
          icon={c.icon}
          color={c.color}
          active={active === c.id}
          onClick={() => onChange(c.id)}
        />
      ))}
    </div>
  );
}

function Pill({
  label,
  icon,
  color,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={active && color ? { backgroundColor: color, borderColor: color } : undefined}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition",
        active
          ? "border-lime-500 bg-lime-500 text-stone-950"
          : "border-black/10 bg-white text-stone-700 hover:border-lime-400 dark:border-white/10 dark:bg-stone-900 dark:text-stone-200"
      )}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}
