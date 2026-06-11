"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const fieldBase =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/30 disabled:cursor-not-allowed disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn("h-10", fieldBase, className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn("min-h-[80px]", fieldBase, className)} {...props} />
));
Textarea.displayName = "Textarea";

type CustomSelectProps = Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> & {
  value?: string;
  onChange?: (event: { target: { value: string } }) => void;
  disabled?: boolean;
  required?: boolean;
  children: React.ReactNode;
};

/** Custom select with a portalled menu so it's never clipped by table overflow. */
export function Select({ className, value = "", onChange, disabled, children }: CustomSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [rect, setRect] = React.useState<
    { left: number; width: number; top?: number; bottom?: number } | null
  >(null);
  const [search, setSearch] = React.useState("");
  // Keyboard-highlighted option while the menu is open (↑/↓ move, Enter selects).
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const searchTimeout = React.useRef<number | null>(null);
  const lastSearchKey = React.useRef<string | null>(null);
  const lastSearchTime = React.useRef<number>(0);
  const repeatCount = React.useRef(0);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const optionRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const options = React.Children.toArray(children)
    .filter(React.isValidElement)
    .map((child) => {
      const props = child.props as { value?: string; children?: React.ReactNode };
      return { value: String(props.value ?? ""), label: props.children };
    });
  // Prefer the matching option. If a value is set but not (yet) in the list —
  // e.g. options still loading, or a saved hostel that's since been removed —
  // show the value itself rather than silently falling back to the placeholder.
  const selected =
    options.find((option) => option.value === value) ??
    (value ? { value, label: value } : options[0]);

  const optionCount = options.length;
  const selectedIndex = options.findIndex((option) => option.value === value);
  const activeValue = activeIndex >= 0 ? options[activeIndex]?.value : undefined;

  // Open the menu with the current selection pre-highlighted.
  const openMenu = () => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };
  const commitOption = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange?.({ target: { value: option.value } });
    setOpen(false);
  };
  const place = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Prefer opening below, but flip above when there isn't enough room and
    // there's more space up top — so the menu is never cut off by the viewport.
    const menuH = menuRef.current?.offsetHeight ?? Math.min(256, optionCount * 38 + 8);
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const openUp = spaceBelow < menuH + 8 && spaceAbove > spaceBelow;
    setRect({
      left: r.left,
      width: r.width,
      top: openUp ? undefined : r.bottom + 4,
      bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
    });
  }, [optionCount]);

  const resetSearch = React.useCallback(() => {
    if (searchTimeout.current) window.clearTimeout(searchTimeout.current);
    searchTimeout.current = window.setTimeout(() => setSearch(""), 500);
  }, []);

  const selectMatchingOption = React.useCallback(
    (key: string) => {
      const lowerKey = key.toLowerCase();
      const now = performance.now();
      const sameKey = lastSearchKey.current === lowerKey && now - lastSearchTime.current < 500;
      const query = sameKey ? lowerKey : (search + lowerKey).toLowerCase();

      if (sameKey) {
        repeatCount.current += 1;
      } else {
        repeatCount.current = 1;
      }
      lastSearchKey.current = lowerKey;
      lastSearchTime.current = now;

      setSearch(query);
      resetSearch();

      let matches = options.filter((option) =>
        String(option.label).toLowerCase().startsWith(query)
      );

      if (!matches.length && query.length > 1) {
        matches = options.filter((option) =>
          String(option.label).toLowerCase().startsWith(lowerKey)
        );
      }

      if (matches.length) {
        const match = matches[(repeatCount.current - 1) % matches.length];
        onChange?.({ target: { value: match.value } });
        setActiveIndex(options.findIndex((option) => option.value === match.value));
        if (open && optionRefs.current[match.value]) {
          optionRefs.current[match.value]?.scrollIntoView({ block: "nearest" });
        }
      }
    },
    [options, onChange, open, resetSearch, search]
  );

  React.useEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
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
  }, [open, place]);

  // Keep the keyboard-highlighted option scrolled into view.
  React.useEffect(() => {
    if (!open || activeValue == null) return;
    optionRefs.current[activeValue]?.scrollIntoView({ block: "nearest" });
  }, [open, activeValue]);

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!open) openMenu();
            else setActiveIndex((i) => Math.min(i + 1, optionCount - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) openMenu();
            else setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (event.key === "Home") {
            if (open) {
              event.preventDefault();
              setActiveIndex(0);
            }
          } else if (event.key === "End") {
            if (open) {
              event.preventDefault();
              setActiveIndex(optionCount - 1);
            }
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!open) openMenu();
            else commitOption(activeIndex);
          } else if (event.key === "Escape") {
            if (open) {
              event.preventDefault();
              setOpen(false);
            }
          } else if (event.key.length === 1 && /^[a-z0-9]$/i.test(event.key)) {
            event.preventDefault();
            selectMatchingOption(event.key);
          }
        }}
        className="flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-white/15 bg-white/5 px-3 text-left text-sm text-white transition hover:bg-white/10 focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/30 disabled:pointer-events-none disabled:opacity-50"
      >
        <span className="min-w-0 truncate">{selected?.label ?? "Select"}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-60 transition", open && "rotate-180")} />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              left: rect.left,
              top: rect.top,
              bottom: rect.bottom,
              width: rect.width,
              zIndex: 1000,
            }}
            className="max-h-64 overflow-y-auto rounded-lg border border-white/15 bg-[#0c0c0c] p-1 text-sm text-white shadow-2xl"
          >
            {options.map((option, i) => (
              <button
                ref={(el) => {
                  optionRefs.current[option.value] = el;
                }}
                key={option.value}
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  onChange?.({ target: { value: option.value } });
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left transition hover:bg-lime-400 hover:text-black",
                  i === activeIndex && "bg-lime-400 text-black"
                )}
              >
                <span className="truncate">{option.label}</span>
                {option.value === value && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-white/75", className)} {...props} />;
}
