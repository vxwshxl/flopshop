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
    <div className={cn("glass rounded-2xl p-4", className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">{label}</p>
        {icon && <span className="text-stone-500">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-extrabold text-stone-950 dark:text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-stone-500 dark:text-stone-500">{hint}</p>}
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
        <div className="glass-line flex items-center justify-between border-b px-4 py-3">
          {title && <h3 className="text-sm font-bold text-stone-900 dark:text-white">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-stone-950 dark:text-white">{title}</h1>
        {subtitle && <p className="text-sm text-stone-500 dark:text-stone-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
