"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Auto-refresh the admin delivery page every 30 seconds
 * so online/offline statuses stay current.
 */
export function AdminDeliveryRefresh() {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router]);

  return null;
}
