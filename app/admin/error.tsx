"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Admin-scoped error boundary. Without it, a failed server render inside
 * /admin bubbles to the root boundary and blows away the whole shell (navbar,
 * sidebar, the lot) for what is usually a transient Supabase fetch hiccup or a
 * stale client bundle talking to a newer deployment.
 *
 * `reset()` re-runs the segment with the bundle already loaded — the right fix
 * for a one-off server error. A full reload is the escape hatch for the stale
 * deployment case, where retrying in place keeps hitting the same wall.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] segment render failed", { digest: error.digest, error });
  }, [error]);

  return (
    <div className="glass mx-auto max-w-lg rounded-2xl p-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/15 text-amber-500">
        <AlertTriangle className="h-7 w-7" strokeWidth={2.2} />
      </div>
      <h2 className="mt-4 text-lg font-bold text-stone-900 dark:text-white">
        This page didn&apos;t load
      </h2>
      <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
        Something failed on our end while loading this section. Retrying usually sorts it.
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw className="h-4 w-4" /> Try again
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4" /> Reload page
        </Button>
      </div>

      {error.digest && (
        <p className="mt-4 font-mono text-[11px] text-stone-500 dark:text-stone-500">
          ref: {error.digest}
        </p>
      )}
    </div>
  );
}
