"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { playOrderChime } from "@/lib/utils/notifySound";
import { notifyNewOrder, type NewOrderInfo } from "@/lib/utils/orderNotify";

/**
 * Keeps the admin dashboard live: when any data in the database changes
 * (orders, users, settings, etc.), refresh the server data so everything
 * stays up to date without a manual reload.
 */
export function AdminRealtime() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin:dashboard")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        router.refresh();
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload: RealtimePostgresInsertPayload<NewOrderInfo>) => {
          // Ring loudly for every new order the open dashboard receives.
          playOrderChime();
          notifyNewOrder(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
