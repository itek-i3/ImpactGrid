import { ok, badRequest } from '@/lib/api/response';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Save (or refresh) the caller's push subscription for this device.
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return badRequest('Unauthorized');

  const body = await request.json().catch(() => ({}));
  const sub = body.subscription || body;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!endpoint || !p256dh || !auth) return badRequest('invalid subscription');

  // Admin upsert so an endpoint reused on a shared device reassigns cleanly.
  const admin = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase;
  const { error } = await admin
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, endpoint, p256dh, auth, user_agent: request.headers.get('user-agent') || null },
      { onConflict: 'endpoint' }
    );
  if (error) return badRequest(error.message);
  return ok({ subscribed: true });
}

// Remove a subscription (e.g. on logout / disable).
export async function DELETE(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return badRequest('Unauthorized');
  const body = await request.json().catch(() => ({}));
  const endpoint = body?.endpoint;
  if (!endpoint) return badRequest('endpoint required');
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id);
  return ok({ removed: true });
}
