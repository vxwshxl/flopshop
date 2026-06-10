import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Branded full-screen status page shared by the 404 / 403 / 401 / 503 routes.
 * Renders inside the root layout (which already provides <html>/<body>), so it
 * only needs the centered card.
 */
export function StatusPage({
  code,
  title,
  message,
  icon,
  action,
}: {
  code: string;
  title: string;
  message: string;
  icon: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-black px-4">
      <div className="glass w-full max-w-md rounded-3xl px-6 py-12 text-center">
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-yellow-400/15 text-yellow-400">
          {icon}
        </div>
        <p className="text-sm font-bold uppercase tracking-widest text-yellow-400">{code}</p>
        <h1 className="mt-1 text-2xl font-extrabold text-white">{title}</h1>
        <p className="mt-3 text-sm text-white/60">{message}</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {action ?? (
            <Link
              href="/"
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Back to shop
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
