import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function getUserProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: 'Unauthorized', status: 401 } };

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*, agency:agency_id(id, slug, name, logo_url)')
    .eq('id', user.id)
    .single();

  if (profileErr) return { data: null, error: profileErr };

  let agencies = [];

  if (profile.role === 'superadmin') {
    // Superadmins can switch to any agency — load them all
    const admin = createAdminClient();
    const { data: allAgencies } = await admin
      .from('agencies')
      .select('id, slug, name, logo_url')
      .order('name');
    agencies = (allAgencies || []).map((a) => ({ ...a, role: 'superadmin' }));
  } else {
    // Regular users: only agencies they belong to via agency_members
    try {
      const { data: memberships, error: memErr } = await supabase
        .from('agency_members')
        .select('role, agency:agency_id(id, slug, name, logo_url)')
        .eq('user_id', user.id)
        .order('joined_at');

      if (!memErr && memberships) {
        agencies = memberships.map((m) => ({ ...m.agency, role: m.role }));
      }
    } catch (_) {}

    // Fallback to profile.agency_id if no memberships found
    if (agencies.length === 0 && profile?.agency) {
      agencies.push({ ...profile.agency, role: profile.role });
    }
  }

  return { data: { ...profile, agencies }, error: null };
}
