"use server";

import { createClient } from "@/lib/supabase/server";
import { sendPushToUsers } from "@/lib/push/server";

/**
 * Sends a test push notification to the signed-in admin's own enabled devices,
 * so they can confirm notifications are working end-to-end.
 */
export async function sendTestNotificationAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { ok: false, error: "Not authorized." };

  // No point sending if this user hasn't enabled alerts on any device yet.
  const { count } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (!count) {
    return { ok: false, error: "Enable alerts first using the bell icon in the top bar." };
  }

  const who = profile.full_name?.trim() || user.email || "admin";
  await sendPushToUsers([user.id], {
    title: "Test Notification",
    body: `Triggered by ${who}`,
    url: "/admin/orders",
    tag: "flopshop-test",
  });
  return { ok: true };
}
