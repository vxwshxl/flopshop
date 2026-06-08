"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Drops in anywhere a server-rendered list should stay live: subscribes to
 * postgres_changes on `table` and calls router.refresh() on any change, so the
 * page updates without a manual reload. Requires the table to be in the
 * supabase_realtime publication.
 */
export function RealtimeRefresh({ table, channel }: { table: string; channel: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(channel)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => router.refresh())
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [router, table, channel]);

  return null;
}
