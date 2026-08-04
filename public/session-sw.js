let notifyTimer = null;

// Without this, a newly deployed SW version sits "waiting" until every tab
// is fully closed and reopened before it takes over — meaning fixes to this
// file (like the notification-click handler below) wouldn't actually apply
// on a phone until a full close+reopen, not just a refresh. skipWaiting +
// clients.claim make a new version take control immediately.
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });

// A pass-through fetch handler — no caching/offline support, just network as
// normal. Some Android/Chrome builds only offer "Install app" for a page once
// its service worker has a fetch handler at all, so this exists purely to
// satisfy that installability check.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener('message', (event) => {
  if (event.data.type === 'SESSION_START') {
    if (notifyTimer) clearTimeout(notifyTimer);
    const delay = event.data.endTime - Date.now();
    if (delay <= 0) return;
    notifyTimer = setTimeout(() => {
      self.registration.showNotification("Time's up!", {
        body: event.data.task ? `"${event.data.task}" — your focus session is complete.` : 'Your focus session is complete.',
        icon: '/os/app-icon-512.png',
        badge: '/os/notification-icon.png',
        tag: 'session-complete',
        requireInteraction: true,
      });
    }, delay);
  }

  if (event.data.type === 'SESSION_CANCEL') {
    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = null;
  }
});

// ── Web Push: show notifications when a message arrives (even app closed) ──
// Stacks same-conversation messages into one notification (WhatsApp-style)
// instead of replacing it, so a burst of messages shows "N new messages".
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch (_) {}
    const tag = data.tag || 'chat';
    const title = data.title || 'New message';

    const [existing] = await self.registration.getNotifications({ tag });
    const count = (existing?.data?.count || 0) + 1;
    const previews = [...(existing?.data?.previews || []), data.body || ''].slice(-3);
    const body = count === 1 ? previews[0] : count <= 3 ? previews.join('\n') : `${count} new messages`;

    await self.registration.showNotification(count > 1 ? `${title} (${count})` : title, {
      body,
      icon: data.icon || '/os/app-icon-512.png',
      badge: '/os/notification-icon.png',
      tag,
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: data.url || '/os/', count, previews },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/os/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) {
        // WindowClient.navigate() isn't reliably supported/successful across
        // browsers — if it silently fails, also message the app so it can
        // navigate with its own router as a guaranteed fallback (a client
        // that's already open otherwise just gets focused on whatever page
        // it happened to be showing, not the chat).
        try { if (c.navigate) await c.navigate(url); } catch (_) {}
        try { c.postMessage({ type: 'NOTIFICATION_NAVIGATE', url }); } catch (_) {}
        return c.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
