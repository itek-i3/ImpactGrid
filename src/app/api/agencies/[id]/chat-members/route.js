import { ok, forbidden, fromSupabaseError } from '@/lib/api/response';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Any authenticated member of the agency can fetch the member list for chat DMs
export async function GET(_, { params }) {
  const { id: agencyId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return forbidden('Not authenticated');

  const admin = createAdminClient();

  // Verify the requester belongs to this agency
  const { data: membership } = await admin
    .from('agency_members')
    .select('user_id')
    .eq('agency_id', agencyId)
    .eq('user_id', user.id)
    .single();

  // Also allow if profiles.agency_id matches (fallback for single-agency setups)
  let allowed = !!membership;
  if (!allowed) {
    const { data: profile } = await admin
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();
    allowed = profile?.agency_id === agencyId;
  }

  if (!allowed) return forbidden('Not a member of this agency');

  // Fetch all members via agency_members → profiles
  const { data: members, error } = await admin
    .from('agency_members')
    .select('user_id, role, profile:profiles!inner(id, full_name, email, role, avatar_url)')
    .eq('agency_id', agencyId);

  if (error) {
    // Fallback: query profiles directly
    const { data: profiles, error: pErr } = await admin
      .from('profiles')
      .select('id, full_name, email, role, avatar_url')
      .eq('agency_id', agencyId);
    if (pErr) return fromSupabaseError(pErr);
    return ok(profiles || []);
  }

  const profiles = (members || [])
    .map(m => m.profile)
    .filter(Boolean);

  return ok(profiles);
}
