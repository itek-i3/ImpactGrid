import { ok, badRequest } from '@/lib/api/response';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// POST — heartbeat: mark the caller as currently online.
// RLS (profiles_update_self) lets a user update their own row.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return badRequest('Unauthorized');

  await supabase
    .from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', user.id);

  return ok({ ok: true });
}

// GET — presence for everyone in this workspace's agency.
// Members can't SELECT peers' profiles under RLS, so read via the admin client.
export async function GET(_, { params }) {
  const { id: workspaceId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return badRequest('Unauthorized');

  const admin = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase;

  const { data: ws } = await admin
    .from('workspaces')
    .select('agency_id')
    .eq('id', workspaceId)
    .single();
  const agencyId = ws?.agency_id;

  const seen = new Set();
  const rows = [];
  const add = (p) => {
    if (!p?.id || seen.has(p.id)) return;
    seen.add(p.id);
    rows.push({ id: p.id, lastSeenAt: p.last_seen_at || null });
  };

  if (agencyId) {
    const { data: members } = await admin
      .from('agency_members')
      .select('user_id')
      .eq('agency_id', agencyId);
    const ids = (members || []).map((m) => m.user_id).filter(Boolean);
    if (ids.length) {
      const { data: mp } = await admin
        .from('profiles')
        .select('id, last_seen_at')
        .in('id', ids);
      (mp || []).forEach(add);
    }

    const { data: ap } = await admin
      .from('profiles')
      .select('id, last_seen_at')
      .eq('agency_id', agencyId);
    (ap || []).forEach(add);
  }

  return ok(rows);
}
