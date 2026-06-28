import { ok, forbidden } from '@/lib/api/response';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(_, { params }) {
  const { id: workspaceId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return forbidden('Not authenticated');

  const admin = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase;
  const seen = new Set();
  const profiles = [];

  const add = (p) => {
    if (!p?.id || seen.has(p.id)) return;
    seen.add(p.id);
    profiles.push(p);
  };

  // Resolve the agency for this workspace
  const { data: ws } = await admin
    .from('workspaces')
    .select('agency_id')
    .eq('id', workspaceId)
    .single();

  const agencyId = ws?.agency_id;

  if (agencyId) {
    // Source 1: users given access via admin panel (agency_members table)
    // agency_members.user_id → auth.users, so query in two steps to avoid join issues
    const { data: members } = await admin
      .from('agency_members')
      .select('user_id')
      .eq('agency_id', agencyId);

    const memberIds = (members || []).map(m => m.user_id).filter(Boolean);

    if (memberIds.length > 0) {
      const { data: memberProfiles } = await admin
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .in('id', memberIds);
      (memberProfiles || []).forEach(add);
    }

    // Source 2: users whose profile.agency_id matches (registered + auto-assigned)
    const { data: agProfiles } = await admin
      .from('profiles')
      .select('id, full_name, email, role, avatar_url')
      .eq('agency_id', agencyId);
    (agProfiles || []).forEach(add);
  }

  // Source 3: final fallback — return everyone so DMs always have contacts
  if (!profiles.length) {
    const { data: all } = await admin
      .from('profiles')
      .select('id, full_name, email, role, avatar_url');
    (all || []).forEach(add);
  }

  return ok(profiles);
}
