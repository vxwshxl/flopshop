"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { playOrderChime } from "@/lib/utils/notifySound";
import { notifyNewOrder, type NewOrderInfo } from "@/lib/utils/orderNotify";

/**
 * Keeps the delivery dashboard live: when any order is created/updated (a new
 * order placed, claimed, or status-changed), refresh the server data so newly
 * available orders show up without a manual reload.
 */
export function DeliveryRealtime() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("delivery:dashboard")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        router.refresh();
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: "order_type=eq.delivery" },
        (payload: RealtimePostgresInsertPayload<NewOrderInfo>) => {
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
