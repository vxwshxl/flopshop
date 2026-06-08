"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface ToggleOption {
  value: string;
  label: React.ReactNode;
}

/**
 * Glass toggle group with a "lens" indicator that glides between options
 * (inspired by Aave's Glass for the Web). The selected label stays legible
 * because the indicator is bright glass and labels sit above it.
 */
export function ToggleGroup({
  options,
  value,
  onChange,
  className,
}: {
  options: ToggleOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const btnRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [lens, setLens] = React.useState({ left: 0, width: 0, ready: false });

  const measure = React.useCallback(() => {
    const container = containerRef.current;
    const el = btnRefs.current[value];
    if (!container || !el) return;
    setLens({ left: el.offsetLeft, width: el.offsetWidth, ready: true });
  }, [value]);

  React.useEffect(() => {
    measure();
  }, [measure, options]);

  React.useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "no-scrollbar glass relative flex w-max max-w-full gap-1 overflow-x-auto rounded-full p-1",
        className
      )}
    >
      {lens.ready && (
        <span
          aria-hidden
          className="glass-lens pointer-events-none absolute bottom-1 top-1 rounded-full transition-[left,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ left: lens.left, width: lens.width }}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              btnRefs.current[o.value] = el;
            }}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors duration-200",
              active
                ? "text-stone-900 dark:text-white"
                : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-white"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
