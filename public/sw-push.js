// Custom SW logic injected alongside Workbox-generated SW
// Handles push notifications and notification click events

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Vootify", body: event.data.text() };
  }

  const { title = "Vootify", body = "", icon, badge, data } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || "/pwa-icon-192.png",
      badge: badge || "/pwa-icon-192.png",
      data: data || {},
      vibrate: [100, 50, 100],
      actions: [
        { action: "open", title: "Ouvrir" },
        { action: "dismiss", title: "Fermer" },
      ],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(url);
    })
  );
});
