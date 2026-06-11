/* FlopShop service worker — Web Push notifications for staff. */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { title: "FlopShop", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "FlopShop";
  const options = {
    body: data.body || "",
    icon: data.icon || "/FlopShop.png",
    badge: "/FlopShop.png",
    // Keep it on screen until the staff member acts, with a vibration "ring".
    requireInteraction: true,
    vibrate: [300, 120, 300, 120, 300],
    tag: data.tag || "flopshop-order",
    renotify: true,
    data: { url: data.url || "/admin/orders" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin/orders";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
