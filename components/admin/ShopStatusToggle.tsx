"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";

export function ShopStatusToggle({ initialOpen }: { initialOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [saving, setSaving] = useState(false);

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
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-lime-500/25 bg-lime-50 p-4 text-left transition hover:bg-lime-100 disabled:opacity-60 dark:border-lime-400/20 dark:bg-lime-400/10 dark:hover:bg-lime-400/15"
    >
      <span className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-lime-400 text-stone-950">
          <Store className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-stone-950 dark:text-white">Shop status</span>
          <span className="block text-xs text-stone-600 dark:text-stone-400">
            {saving ? "Updating..." : open ? "Open for orders" : "Closed for orders"}
          </span>
        </span>
      </span>
      <span
        className={`relative h-7 w-12 rounded-full transition ${open ? "bg-lime-500" : "bg-stone-300 dark:bg-stone-700"}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
            open ? "left-6" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}
