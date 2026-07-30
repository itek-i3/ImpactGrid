let notifyTimer = null;

self.addEventListener('message', (event) => {
  if (event.data.type === 'SESSION_START') {
    if (notifyTimer) clearTimeout(notifyTimer);
    const delay = event.data.endTime - Date.now();
    if (delay <= 0) return;
    notifyTimer = setTimeout(() => {
      self.registration.showNotification("Time's up!", {
        body: event.data.task ? `"${event.data.task}" — your focus session is complete.` : 'Your focus session is complete.',
        icon: '/logo3.png',
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
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = data.title || 'New message';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: data.icon || '/logo3.png',
      badge: data.badge || '/logo3.png',
      tag: data.tag || 'chat',
      renotify: true,
      data: { url: data.url || '/os/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/os/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) { try { if (c.navigate) await c.navigate(url); } catch (_) {} return c.focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
