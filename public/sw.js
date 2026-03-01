self.addEventListener("push", function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Furlads", body: "Reminder" };
  }

  const title = data.title || "Furlads";
  const options = {
    body: data.body || "Just checking you're all good 👍",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/badge-72.png",
    data: data.data || {},
    requireInteraction: false,
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "/today";

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });

      for (const client of allClients) {
        if ("focus" in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }

      if (clients.openWindow) {
        await clients.openWindow(targetUrl);
      }
    })()
  );
});