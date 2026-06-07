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
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition",
        active
          ? "border-brand bg-brand text-brand-ink"
          : "border-line bg-card text-content hover:border-brand/60"
      )}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}
