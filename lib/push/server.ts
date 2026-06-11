import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createAdminClient>;

function getKeys(): { publicKey: string; privateKey: string } | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey };
}

/**
 * VAPID "subject" — a contact for the push service. Uses the shop's configured
 * email (Settings → Email) when set, otherwise falls back to env / a default.
 */
async function getSubject(admin: AdminClient): Promise<string> {
  const { data } = await admin.from("settings").select("value").eq("key", "shop_email").single();
  const email = (data?.value ?? "").trim();
  if (email) return `mailto:${email}`;
  return process.env.VAPID_SUBJECT || "mailto:admin@flopshop.app";
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
  const keys = getKeys();
  if (!userIds.length || !keys) return;
  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (!subs?.length) return;
  const body = JSON.stringify(payload);
  const subject = await getSubject(admin);
  const options = { vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey } };

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          options
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

/**
 * Notify staff when a new customer order comes in:
 *  - every admin gets it (pickup or delivery)
 *  - delivery partners get delivery orders, framed as claimable
 * Dynamic body names the customer + amount. Best-effort (never throws).
 */
export async function notifyNewOrder(order: {
  id: string;
  order_number: string;
  order_type: string;
  total_amount: number;
  customer_name: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: people } = await admin.from("profiles").select("id, role").in("role", ["admin", "delivery"]);
    const adminIds = (people ?? []).filter((p) => p.role === "admin").map((p) => p.id);
    const deliveryIds = (people ?? []).filter((p) => p.role === "delivery").map((p) => p.id);

    const who = order.customer_name?.trim() || "Someone";
    const amount = `₹${Number(order.total_amount).toFixed(0)}`;

    await sendPushToUsers(adminIds, {
      title: `New ${order.order_type} order`,
      body: `${who} · ${amount} · ${order.order_number}`,
      url: `/admin/orders/${order.id}`,
      tag: `order-${order.order_number}`,
    });

    if (order.order_type === "delivery") {
      await sendPushToUsers(deliveryIds, {
        title: "New delivery available 🛵",
        body: `${who} · ${amount} — tap to claim`,
        url: "/delivery",
        tag: `order-${order.order_number}`,
      });
    }
  } catch {
    // Notifications are best-effort — never fail the order on a push error.
  }
}
