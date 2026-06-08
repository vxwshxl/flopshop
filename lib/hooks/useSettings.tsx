"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { settingsToMap, DEFAULT_SETTINGS } from "@/lib/utils/settings";
import type { SettingsMap } from "@/lib/types";

export function useSettings() {
  const [settings, setSettings] = useState<SettingsMap>(DEFAULT_SETTINGS);

  useEffect(() => {
    const supabase = createClient();

    let mounted = true;

    async function load() {
      const { data } = await supabase.from("settings").select("key,value");
      if (!mounted) return;
      if (data) setSettings((s) => ({ ...s, ...settingsToMap(data) }));
    }
    load();

    const chan = supabase
      .channel("public:settings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings" },
        (payload: any) => {
          const rec = payload.new ?? payload.old;
          if (!rec) return;
          setSettings((prev) => ({ ...prev, [(rec as any).key]: (rec as any).value }));
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      try {
        supabase.removeChannel(chan);
      } catch (e) {
        // ignore
      }
    };
  }, []);

  const isOpen = settings.shop_is_open !== "false";
  return { settings, isOpen };
}
