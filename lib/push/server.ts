import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";

let configured = false;

/** Lazily configure web-push with the VAPID keys (no-op if env is missing). */
function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@flopshop.app", publicKey, privateKey);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Sends a push notification to every device subscribed for the given users.
 * Dead subscriptions (410/404) are pruned. Never throws — best-effort.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (!userIds.length || !ensureConfigured()) return;
  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (!subs?.length) return;
  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    })
  );
}

/** Notify all admins + delivery partners that a new order came in. */
export async function notifyStaffNewOrder(order: {
  order_number: string;
  order_type: string;
  total_amount: number;
  customer_name: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { data: staff } = await admin.from("profiles").select("id").in("role", ["admin", "delivery"]);
  const ids = (staff ?? []).map((p) => p.id);
  await sendPushToUsers(ids, {
    title: `New ${order.order_type} order · ${order.order_number}`,
    body: `${order.customer_name || "Customer"} · ₹${Number(order.total_amount).toFixed(0)}`,
    url: "/admin/orders",
    tag: `order-${order.order_number}`,
  });
}
