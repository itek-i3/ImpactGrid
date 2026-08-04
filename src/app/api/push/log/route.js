import { ok } from '@/lib/api/response';

// Temporary diagnostic sink for the service worker — since a phone's own
// console isn't reachable remotely, session-sw.js pings this on
// notificationclick so we can confirm in server logs whether the click
// handler is actually firing at all, and how far it gets.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  console.log('[sw-log]', JSON.stringify(body));
  return ok({ logged: true });
}
