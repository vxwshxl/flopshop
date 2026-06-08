"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
      .channel("delivery:orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
