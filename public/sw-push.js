// Custom SW logic injected alongside Workbox-generated SW
// Handles push notifications, notification click events, and offline resilience

// ── Offline resilience: catch failed fetch responses from Workbox handlers ──
// When Workbox's runtimeCaching handlers fail (e.g. opaque response errors),
// return a fallback instead of letting the error propagate to FetchEvent.respondWith
self.addEventListener("fetch", (event) => {
  // Only handle navigation requests not already handled by Workbox
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          // Try network first for navigation
          const response = await fetch(event.request);
          return response;
        } catch {
          // Network failed — serve cached index.html as SPA fallback
          const cache = await caches.match("/index.html");
          if (cache) return cache;
          // Last resort: try any cached version
          const keys = await caches.keys();
          for (const name of keys) {
            const c = await caches.open(name);
            const match = await c.match("/index.html");
            if (match) return match;
          }
          return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
        }
      })()
    );
  }
});

// ── Push Notifications ──
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
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
