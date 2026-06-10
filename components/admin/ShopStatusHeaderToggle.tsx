"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { useSettings } from "@/lib/hooks/useSettings";

/**
 * Compact yellow open/closed switch for the admin header — a one-tap shortcut
 * for the full toggle in Settings. Reads live status from the shared settings
 * provider (so it stays in sync with the badge) and writes back to the same
 * `shop_is_open` setting.
 */
export function ShopStatusHeaderToggle() {
  const router = useRouter();
  const { isOpen } = useSettings();
  const [open, setOpen] = useState(isOpen);
  const [saving, setSaving] = useState(false);

  // Follow the live setting unless we're mid-save (keep the optimistic value).
  useEffect(() => {
    if (!saving) setOpen(isOpen);
  }, [isOpen, saving]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    setSaving(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("settings")
      .update({ value: next ? "true" : "false", updated_at: new Date().toISOString() })
      .eq("key", "shop_is_open");

    setSaving(false);
    if (error) {
      setOpen(!next);
      toast.error(`Could not update shop status: ${error.message}`);
      return;
    }

    toast.success(`Shop is now ${next ? "open" : "closed"}`);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      aria-pressed={open}
      title={open ? "Shop is open — tap to close" : "Shop is closed — tap to open"}
      className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide transition disabled:opacity-60 ${
        open
          ? "border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20"
          : "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
      }`}
    >
      <span>{open ? "OPEN" : "CLOSED"}</span>
      <span className={`relative h-4 w-7 rounded-full transition ${open ? "bg-green-500" : "bg-red-500"}`}>
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${open ? "left-3.5" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}
