"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
