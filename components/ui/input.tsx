import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-black placeholder:text-black/45 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-black dark:text-white dark:placeholder:text-white/40",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[80px] w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-black placeholder:text-black/45 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-black dark:text-white dark:placeholder:text-white/40",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

type CustomSelectProps = Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> & {
  value?: string;
  onChange?: (event: { target: { value: string } }) => void;
  disabled?: boolean;
  required?: boolean;
  children: React.ReactNode;
};

export function Select({ className, value = "", onChange, disabled, children }: CustomSelectProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const options = React.Children.toArray(children)
    .filter(React.isValidElement)
    .map((child) => {
      const props = child.props as { value?: string; children?: React.ReactNode };
      return { value: String(props.value ?? ""), label: props.children };
    });
  const selected = options.find((option) => option.value === value) ?? options[0];

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((next) => !next)}
        className="flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-black/15 bg-white px-3 text-left text-sm text-black transition hover:bg-black/5 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 disabled:pointer-events-none disabled:opacity-50 dark:border-white/15 dark:bg-black dark:text-white dark:hover:bg-white/10"
      >
        <span className="min-w-0 truncate">{selected?.label ?? "Select"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-black/15 bg-white p-1 text-sm text-black shadow-xl dark:border-white/15 dark:bg-black dark:text-white">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange?.({ target: { value: option.value } });
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left hover:bg-yellow-400 hover:text-black"
            >
              <span className="truncate">{option.label}</span>
              {option.value === value && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-black/75 dark:text-white/75", className)}
      {...props}
    />
  );
}
