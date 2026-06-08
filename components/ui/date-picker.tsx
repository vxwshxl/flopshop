"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Dark calendar date picker. `value`/`onChange` use YYYY-MM-DD strings. */
export function DatePicker({
  value,
  onChange,
  className,
  placeholder = "Pick a date",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState(() => (value ? parseISO(value) : new Date()));
  const [rect, setRect] = React.useState<{ left: number; top: number } | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const selected = value ? parseISO(value) : null;

  const place = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.bottom + 6 });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    // Sync the visible month to the current value each time the popover opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView(value ? parseISO(value) : new Date());
    place();
    const onScroll = () => place();
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !document.getElementById("dp-pop")?.contains(t)) {
        setOpen(false);
      }
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    document.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, place, value]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(view)),
    end: endOfWeek(endOfMonth(view)),
  });

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 text-left text-sm text-white transition hover:bg-white/10 focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/30"
      >
        <CalendarDays className="h-4 w-4 shrink-0 opacity-60" />
        <span className={cn("truncate", !selected && "text-white/40")}>
          {selected ? format(selected, "dd MMM yyyy") : placeholder}
        </span>
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            id="dp-pop"
            style={{ position: "fixed", left: rect.left, top: rect.top, zIndex: 1000 }}
            className="w-72 rounded-xl border border-white/15 bg-[#0c0c0c] p-3 shadow-2xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setView((v) => addMonths(v, -1))}
                className="grid h-7 w-7 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-white">{format(view, "MMMM yyyy")}</span>
              <button
                type="button"
                onClick={() => setView((v) => addMonths(v, 1))}
                className="grid h-7 w-7 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-medium uppercase text-white/40">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {days.map((day) => {
                const isSel = selected && isSameDay(day, selected);
                const muted = !isSameMonth(day, view);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => {
                      onChange(format(day, "yyyy-MM-dd"));
                      setOpen(false);
                    }}
                    className={cn(
                      "h-8 rounded-md text-sm transition",
                      isSel
                        ? "bg-lime-400 font-bold text-black"
                        : "text-white/80 hover:bg-white/10",
                      muted && !isSel && "text-white/25"
                    )}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
