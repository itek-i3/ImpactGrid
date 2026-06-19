import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function listAgencies() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('agencies')
    .select('*')
    .order('name');
  return { data, error };
}

export async function listUserAgencies() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };

  const { data, error } = await supabase
    .from('agency_members')
    .select('role, joined_at, agency:agency_id(id, name, slug, logo_url)')
    .eq('user_id', user.id)
    .order('joined_at');

  const mapped = (data || []).map((m) => ({ ...m.agency, role: m.role, joinedAt: m.joined_at }));
  return { data: error ? [] : mapped, error };
}

export async function addAgencyMember(agencyId, userId, role = 'member') {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('agency_members')
    .upsert({ agency_id: agencyId, user_id: userId, role }, { onConflict: 'user_id,agency_id' })
    .select()
    .single();
  return { data, error };
}

export async function removeAgencyMember(agencyId, userId) {
  const admin = createAdminClient();
  const { error } = await admin
    .from('agency_members')
    .delete()
    .eq('agency_id', agencyId)
    .eq('user_id', userId);
  return { error };
}

export async function listAgencyMembers(agencyId) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('agency_members')
    .select('role, joined_at, user:user_id(id, email, raw_user_meta_data)')
    .eq('agency_id', agencyId)
    .order('joined_at');
  return { data, error };
}

export async function createAgency({ name, slug, logoUrl = null }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('agencies')
    .insert({ name, slug, logo_url: logoUrl })
    .select()
    .single();
  return { data, error };
}

export async function updateAgencyLogo(agencyId, logoUrl) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('agencies')
    .update({ logo_url: logoUrl || null })
    .eq('id', agencyId)
    .select()
    .single();
  return { data, error };
}
