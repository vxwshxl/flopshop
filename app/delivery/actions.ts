"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Toggle the delivery partner's online status.
 * Also stamps last_active_at so the heartbeat window starts fresh.
 */
export async function setOnlineStatusAction(isOnline: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("profiles")
    .update({
      is_online: isOnline,
      last_active_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/delivery");
  return { ok: true };
}

/**
 * Heartbeat: update last_active_at to prove the partner is still online.
 * Called every ~60 seconds from the client.
 */
export async function heartbeatAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", user.id)
    .eq("is_online", true);
}
