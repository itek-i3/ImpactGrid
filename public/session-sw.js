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
