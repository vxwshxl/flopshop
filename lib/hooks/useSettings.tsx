"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { settingsToMap, DEFAULT_SETTINGS } from "@/lib/utils/settings";
import type { SettingsMap } from "@/lib/types";

const SettingsContext = createContext<SettingsMap>(DEFAULT_SETTINGS);

/**
 * Holds shop settings for the whole client subtree and keeps them in sync via a
 * SINGLE Supabase realtime channel. Seed it with the server-rendered settings
 * (`initial`) so the first client render matches SSR (no flash, no hydration
 * mismatch). Every `useSettings()` consumer reads this one source — previously
 * each consumer opened its own `public:settings` channel, which both wasted
 * connections and triggered "cannot add postgres_changes callbacks ... after
 * subscribe()" when channels collided.
 */
export function SettingsProvider({
  initial,
  children,
}: {
  initial?: SettingsMap;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<SettingsMap>(() => ({
    ...DEFAULT_SETTINGS,
    ...(initial ?? {}),
  }));

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const refresh = () => {
      supabase
        .from("settings")
        .select("key,value")
        .then(({ data }: { data: { key: string; value: string }[] | null }) => {
          if (mounted && data) setSettings((s) => ({ ...s, ...settingsToMap(data) }));
        });
    };

    // Re-fetch on mount, and whenever the tab regains focus — this keeps shop
    // status fresh even if realtime isn't delivering (e.g. the settings table
    // isn't in the supabase_realtime publication yet).
    refresh();
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);

    // One channel for the whole app. `.on()` is attached before `.subscribe()`,
    // and the channel is torn down on unmount so HMR/StrictMode can't leak it.
    const channel = supabase
      .channel("public:settings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings" },
        (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
          if (!mounted) return;
          const rec = (payload.new ?? payload.old) as { key?: string; value?: string } | null;
          if (!rec?.key) return;
          setSettings((prev) => ({ ...prev, [rec.key as string]: rec.value ?? "" }));
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, []);

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

/** Read shop settings (and the derived open/closed flag) from the provider. */
export function useSettings() {
  const settings = useContext(SettingsContext);
  const isOpen = settings.shop_is_open !== "false";
  return { settings, isOpen };
}
