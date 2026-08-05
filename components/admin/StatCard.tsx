import { cn } from "@/lib/utils/cn";

export function StatCard({
  label,
  value,
  icon,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("stat-card glass rounded-2xl p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 break-words text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          {label}
        </p>
        {icon && <span className="shrink-0 text-stone-500">{icon}</span>}
      </div>
      <p className="stat-value mt-2 font-extrabold text-stone-950 dark:text-white">{value}</p>
      {hint && <p className="mt-1 break-words text-xs text-stone-500 dark:text-stone-500">{hint}</p>}
    </div>
  );
}

export function AdminCard({
  title,
  children,
  className,
  action,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("glass rounded-2xl", className)}>
      {(title || action) && (
        <div className="glass-line flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b px-4 py-3">
          {title && <h3 className="min-w-0 break-words text-sm font-bold text-stone-900 dark:text-white">{title}</h3>}
          {action}
        </div>
      )}
      <div className="min-w-0 p-4">{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  mobileJustifyBetween = false,
}: {
  title: string | React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  mobileJustifyBetween?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className={`flex min-w-0 items-center gap-2 sm:gap-3 flex-nowrap ${mobileJustifyBetween ? "w-full justify-between sm:w-auto sm:justify-start" : ""}`}>
        {typeof title === "string" ? (
          <h1 className="truncate text-xl sm:text-2xl font-extrabold text-stone-950 dark:text-white">{title}</h1>
        ) : (
          title
        )}
        {subtitle && <div className="min-w-0 truncate text-sm text-stone-500 dark:text-stone-400">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}
