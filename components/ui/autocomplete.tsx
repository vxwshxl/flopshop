"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/input";

interface AutocompleteProps<T> {
  value: string;
  onChange: (value: string) => void;
  /** Already-filtered suggestions to show (computed by the parent from `value`). */
  items: T[];
  getKey: (item: T) => string;
  /** The text written into the field when this item is picked. */
  getLabel: (item: T) => string;
  /** Called when a suggestion is chosen (click or Enter). */
  onPick: (item: T) => void;
  /** Optional secondary content shown on the right of a row (e.g. phone). */
  renderRight?: (item: T) => React.ReactNode;
  placeholder?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
}

/**
 * Text input with a suggestions dropdown. The menu reopens whenever the user
 * types — including right after picking an item — so clearing and retyping
 * always re-shows matches without needing to blur/refocus the field. The
 * keyboard-highlighted row uses the FlopShop yellow so the selection is obvious.
 */
export function Autocomplete<T>({
  value,
  onChange,
  items,
  getKey,
  getLabel,
  onPick,
  renderRight,
  placeholder,
  required,
  className,
  inputClassName,
}: AutocompleteProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [activeRaw, setActive] = React.useState(0);
  const blurTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clamp the highlighted row so it stays valid as the match list changes.
  const active = Math.min(activeRaw, Math.max(items.length - 1, 0));
  const show = open && items.length > 0;

  function pick(item: T) {
    onPick(item);
    setOpen(false);
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        required={required}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setActive(0);
          // Reopen on every keystroke so retyping after a pick works.
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const item = items[active];
            if (item) pick(item);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        onFocus={() => setOpen(true)}
        // Delay so a click on a suggestion registers before the menu closes.
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClassName}
      />
      {show && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-black/15 bg-white text-black shadow-xl dark:border-white/15 dark:bg-stone-900 dark:text-white">
          {items.map((item, i) => (
            <button
              type="button"
              key={getKey(item)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(item)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition",
                i === active
                  ? "bg-yellow-400 text-black"
                  : "text-stone-700 hover:bg-yellow-400 hover:text-black dark:text-stone-200 dark:hover:text-black"
              )}
            >
              <span className="truncate">{getLabel(item)}</span>
              {renderRight && <span className="shrink-0 text-xs opacity-70">{renderRight(item)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
