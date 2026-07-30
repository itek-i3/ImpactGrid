import { createAdminClient } from '@/lib/supabase/server';

// web-push is imported lazily so the app still builds/runs before the package is
// installed or VAPID keys are set — push just no-ops until both are in place.
let configuredWebpush = null;
async function getWebpush() {
  if (configuredWebpush) return configuredWebpush;
  const pub = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return null;
  let webpush;
  try { webpush = (await import('web-push')).default; } catch { return null; } // package not installed yet
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:notifications@impactgrid.app', pub, priv);
  configuredWebpush = webpush;
  return webpush;
}

// Send a push notification to every device of the given user ids. Best-effort:
// never throws into the caller, and prunes dead subscriptions (404/410).
export async function sendPushToUsers(userIds, payload) {
  try {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length) return;
    const webpush = await getWebpush();
    if (!webpush) return;
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
    const admin = createAdminClient();
    const { data: subs } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth').in('user_id', ids);
    if (!subs?.length) return;
    const body = JSON.stringify(payload || {});
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint).then(() => {}, () => {});
        }
      }
    }));
  } catch (_) { /* never break message sending */ }
}
