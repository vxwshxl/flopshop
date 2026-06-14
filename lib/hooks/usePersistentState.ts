"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useState whose value is mirrored to localStorage under `key`, so admin list
 * filters/search/sort/pagination survive navigation (edit → back) and reloads.
 *
 * Restores on mount rather than in the initializer so server and first-client
 * renders match (no hydration mismatch). Persistence is enabled one frame after
 * the restore commits, so the restored value — not the initial one — is the
 * first thing written back. Pass `key: undefined` to opt out (plain useState).
 */
export function usePersistentState<T>(key: string | undefined, initial: T) {
  const [state, setState] = useState<T>(initial);
  const ready = useRef(false);

  useEffect(() => {
    ready.current = false;
    if (key) {
      try {
        const raw = localStorage.getItem(key);
        // Restoring after mount (not in the initializer) is what keeps the server
        // and first-client renders identical, so the setState here is intentional.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (raw != null) setState(JSON.parse(raw) as T);
      } catch {
        /* ignore corrupt/unavailable storage */
      }
    }
    const id = requestAnimationFrame(() => {
      ready.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [key]);

  useEffect(() => {
    if (!key || !ready.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* ignore quota/unavailable storage */
    }
  }, [key, state]);

  return [state, setState] as const;
}
