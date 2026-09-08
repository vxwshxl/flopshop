"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ToggleOption {
  value: string;
  label: React.ReactNode;
}

/**
 * Glass toggle group with a "lens" indicator that glides between options
 * (inspired by Aave's Glass for the Web). The selected label stays legible
 * because the indicator is bright glass and labels sit above it.
 *
 * `variant="solid"` swaps the lens for filled primary boxes — used by the
 * storefront's top-level category row, where the choice is a section of the
 * shop rather than a view of the same list and deserves the heavier weight.
 *
 * `scrollArrows` adds pointer-only nudge buttons at the edges for rows that
 * outgrow their container (the category chips). Touch users keep swiping, so
 * the arrows stay hidden below `md`.
 */
export function ToggleGroup({
  options,
  value,
  onChange,
  className,
  scrollArrows = false,
  variant = "lens",
}: {
  options: ToggleOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  scrollArrows?: boolean;
  variant?: "lens" | "solid";
}) {
  const solid = variant === "solid";
  const containerRef = React.useRef<HTMLDivElement>(null);
  const btnRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [lens, setLens] = React.useState({ left: 0, width: 0, ready: false });
  const [overflow, setOverflow] = React.useState({ left: false, right: false });

  const measure = React.useCallback(() => {
    const container = containerRef.current;
    const el = btnRefs.current[value];
    // No lens to place in the solid variant — skip the state write so a
    // selection there doesn't re-render the row for nothing.
    if (!container || !el || solid) return;
    setLens({ left: el.offsetLeft, width: el.offsetWidth, ready: true });
  }, [value, solid]);

  const measureOverflow = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // 1px slack: sub-pixel widths otherwise leave an arrow lit at the end.
    setOverflow({ left: el.scrollLeft > 1, right: el.scrollLeft < max - 1 });
  }, []);

  React.useEffect(() => {
    measure();
    measureOverflow();
  }, [measure, measureOverflow, options]);

  React.useEffect(() => {
    const onResize = () => {
      measure();
      measureOverflow();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measure, measureOverflow]);

  // Chips can reflow after the emoji/webfont lands, which changes what overflows.
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || !scrollArrows || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      measure();
      measureOverflow();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, measureOverflow, scrollArrows]);

  const nudge = (direction: 1 | -1) => {
    const el = containerRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({
      left: direction * Math.max(200, el.clientWidth * 0.7),
      behavior: reduced ? "auto" : "smooth",
    });
  };

  const row = (
    <div
      ref={containerRef}
      onScroll={scrollArrows ? measureOverflow : undefined}
      className={cn(
        "no-scrollbar relative flex w-max max-w-full gap-2 overflow-x-auto p-1",
        className
      )}
    >
      {!solid && lens.ready && (
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
            aria-pressed={active}
            className={cn(
              "relative z-10 flex shrink-0 items-center gap-1.5 border text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400/60",
              // Solid boxes carry a full 44px touch target; the lens pills are
              // a secondary row and keep their lighter height.
              solid ? "min-h-11 rounded-xl px-4" : "rounded-full px-4 py-1.5",
              active && solid && "border-transparent bg-lime-400 text-black",
              active && !solid && "border-transparent text-black",
              !active && solid &&
                "border-white/15 bg-white/[0.04] text-white/75 hover:border-white/35 hover:bg-white/10 hover:text-white",
              !active && !solid &&
                "border-white/25 text-white/70 hover:border-white/50 hover:text-white"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );

  if (!scrollArrows) return row;

  return (
    <div className="relative w-max max-w-full">
      {row}
      <ScrollArrow side="left" show={overflow.left} onClick={() => nudge(-1)} />
      <ScrollArrow side="right" show={overflow.right} onClick={() => nudge(1)} />
    </div>
  );
}

function ScrollArrow({
  side,
  show,
  onClick,
}: {
  side: "left" | "right";
  show: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <div
      aria-hidden={!show}
      className={cn(
        "pointer-events-none absolute inset-y-0 z-20 hidden items-center transition-opacity duration-200 md:flex",
        // The scrim lets chips slide under the arrow instead of colliding with it.
        side === "left"
          ? "left-0 pr-10 bg-gradient-to-r from-black from-55% to-transparent"
          : "right-0 pl-10 bg-gradient-to-l from-black from-55% to-transparent",
        show ? "opacity-100" : "opacity-0"
      )}
    >
      <button
        type="button"
        tabIndex={show ? 0 : -1}
        onClick={onClick}
        aria-label={side === "left" ? "Scroll categories left" : "Scroll categories right"}
        className={cn(
          "grid h-8 w-8 place-items-center rounded-full bg-lime-400 text-stone-900 shadow-sm ring-1 ring-black/5 transition hover:bg-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-95",
          show ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={3} />
      </button>
    </div>
  );
}
