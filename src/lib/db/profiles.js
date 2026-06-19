import { createClient } from '@/lib/supabase/server';

export async function getUserProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: 'Unauthorized', status: 401 } };

  const [profileRes, membershipsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*, agency:agency_id(id, slug, name, logo_url)')
      .eq('id', user.id)
      .single(),
    supabase
      .from('agency_members')
      .select('role, agency:agency_id(id, slug, name, logo_url)')
      .eq('user_id', user.id)
      .order('joined_at'),
  ]);

  if (profileRes.error) return { data: null, error: profileRes.error };

  const agencies = (membershipsRes.data || []).map((m) => ({ ...m.agency, role: m.role }));

  // Fallback: if agency_members is empty but profile has agency_id, include it
  if (agencies.length === 0 && profileRes.data?.agency) {
    agencies.push({ ...profileRes.data.agency, role: profileRes.data.role });
  }

  return { data: { ...profileRes.data, agencies }, error: null };
}
