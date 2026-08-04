"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
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
  /**
   * Show a filter box at the top of the menu. Defaults to on once the list is
   * long enough to be worth scrolling (see SEARCHABLE_THRESHOLD).
   */
  searchable?: boolean;
  searchPlaceholder?: string;
  children: React.ReactNode;
};

/** Lists at least this long get a search box unless `searchable` says otherwise. */
const SEARCHABLE_THRESHOLD = 8;

/**
 * Flatten an option's label to plain text so it can be matched by the search
 * box — labels may be rich nodes (thumbnail + name), not just strings.
 */
function nodeText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(" ");
  if (React.isValidElement(node))
    return nodeText((node.props as { children?: React.ReactNode }).children);
  return "";
}

/** Custom select with a portalled menu so it's never clipped by table overflow. */
export function Select({
  className,
  value = "",
  onChange,
  disabled,
  searchable,
  searchPlaceholder = "Search…",
  children,
}: CustomSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [rect, setRect] = React.useState<
    { left: number; width: number; top?: number; bottom?: number } | null
  >(null);
  const [search, setSearch] = React.useState("");
  // Text typed into the menu's search box (separate from the typeahead buffer).
  const [filter, setFilter] = React.useState("");
  // Keyboard-highlighted option while the menu is open (↑/↓ move, Enter selects).
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const searchTimeout = React.useRef<number | null>(null);
  const lastSearchKey = React.useRef<string | null>(null);
  const lastSearchTime = React.useRef<number>(0);
  const repeatCount = React.useRef(0);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const optionRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const options = React.Children.toArray(children)
    .filter(React.isValidElement)
    .map((child) => {
      const props = child.props as {
        value?: string;
        children?: React.ReactNode;
        /** Extra text to match on when the visible label isn't enough. */
        "data-search"?: string;
      };
      return {
        value: String(props.value ?? ""),
        label: props.children,
        text: `${nodeText(props.children)} ${props["data-search"] ?? ""}`.toLowerCase(),
      };
    });
  // Prefer the matching option. If a value is set but not (yet) in the list —
  // e.g. options still loading, or a saved hostel that's since been removed —
  // show the value itself rather than silently falling back to the placeholder.
  const selected =
    options.find((option) => option.value === value) ??
    (value ? { value, label: value } : options[0]);

  const showSearch = searchable ?? options.length >= SEARCHABLE_THRESHOLD;
  // What the menu actually renders — every option until the search box narrows it.
  const q = filter.trim().toLowerCase();
  const visible = q ? options.filter((option) => option.text.includes(q)) : options;

  const optionCount = visible.length;
  const activeValue = activeIndex >= 0 ? visible[activeIndex]?.value : undefined;

  // Open the menu (unfiltered) with the current selection pre-highlighted.
  const openMenu = () => {
    const index = options.findIndex((option) => option.value === value);
    setFilter("");
    setActiveIndex(index >= 0 ? index : 0);
    setOpen(true);
  };
  const commitOption = (index: number) => {
    const option = visible[index];
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
    const menuH =
      menuRef.current?.offsetHeight ??
      Math.min(288, optionCount * 38 + 8 + (showSearch ? 44 : 0));
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const openUp = spaceBelow < menuH + 8 && spaceAbove > spaceBelow;
    setRect({
      left: r.left,
      width: r.width,
      top: openUp ? undefined : r.bottom + 4,
      bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
    });
  }, [optionCount, showSearch]);

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
        setFilter("");
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

  // Type straight into the search box the moment the menu opens.
  React.useEffect(() => {
    if (open && showSearch) searchRef.current?.focus();
  }, [open, showSearch]);

  /** Arrow/Enter/Escape handling shared by the trigger and the search box. */
  function menuKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, optionCount - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      commitOption(activeIndex);
    } else if (event.key === "Escape") {
      event.preventDefault();
      // Don't let Escape bubble out and close a surrounding modal too.
      event.stopPropagation();
      setOpen(false);
      setFilter("");
      triggerRef.current?.focus();
    }
  }

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
              event.stopPropagation();
              setOpen(false);
              setFilter("");
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
            className="flex max-h-72 flex-col overflow-hidden rounded-lg border border-white/15 bg-[#0c0c0c] p-1 text-sm text-white shadow-2xl"
          >
            {showSearch && (
              <div className="relative mb-1 shrink-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                <input
                  ref={searchRef}
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={menuKeyDown}
                  placeholder={searchPlaceholder}
                  autoComplete="off"
                  className="h-9 w-full rounded-md border border-white/15 bg-white/5 pl-8 pr-2.5 text-sm text-white placeholder:text-white/40 focus:border-lime-400 focus:outline-none"
                />
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {visible.length === 0 && (
                <p className="px-2.5 py-3 text-center text-xs text-white/40">No matches</p>
              )}
              {visible.map((option, i) => (
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
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.value === value && <Check className="h-4 w-4 shrink-0" />}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-white/75", className)} {...props} />;
}
