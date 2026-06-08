"use client";

import { useSettings } from "@/lib/hooks/useSettings";

/** Live "shop is closed" banner — appears/disappears in real time with the shop status. */
export function ShopClosedBanner() {
  const { isOpen } = useSettings();
  if (isOpen) return null;

  return (
    <div className="bg-red-50 px-4 py-2 text-center text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
      The shop is currently closed. You can browse but not place orders.
    </div>
  );
}
