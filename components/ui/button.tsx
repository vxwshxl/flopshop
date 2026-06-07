import * as React from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "dark";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-yellow-400 text-black hover:bg-yellow-300",
  secondary: "bg-white text-black hover:bg-yellow-400 dark:bg-black dark:text-white dark:hover:bg-yellow-400 dark:hover:text-black",
  outline: "border border-black/15 bg-white text-black hover:bg-yellow-400 dark:border-white/15 dark:bg-black dark:text-white dark:hover:bg-yellow-400 dark:hover:text-black",
  ghost: "text-black hover:bg-yellow-400 dark:text-white dark:hover:bg-yellow-400 dark:hover:text-black",
  danger: "bg-black text-white hover:bg-yellow-400 hover:text-black dark:bg-white dark:text-black dark:hover:bg-yellow-400",
  dark: "bg-black text-white hover:bg-yellow-400 hover:text-black dark:bg-white dark:text-black dark:hover:bg-yellow-400",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-9 w-9",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
);
Button.displayName = "Button";
