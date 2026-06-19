import { createClient } from '@/lib/supabase/server';

export async function listWorkspaces(activeAgencyId = null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: 'Unauthorized', status: 401 } };

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('role, agency_id')
    .eq('id', user.id)
    .single();

  if (profileErr) return { data: null, error: profileErr };

  let query = supabase.from('workspaces').select('*, agencies(logo_url)');

  if (profile.role === 'superadmin') {
    if (activeAgencyId) query = query.eq('agency_id', activeAgencyId);
  } else {
    // Look up all agencies the user belongs to via agency_members
    const { data: memberships } = await supabase
      .from('agency_members')
      .select('agency_id')
      .eq('user_id', user.id);

    let agencyIds = (memberships || []).map((m) => m.agency_id);

    // Fallback to profile.agency_id for users not yet in agency_members
    if (agencyIds.length === 0 && profile.agency_id) agencyIds = [profile.agency_id];
    if (agencyIds.length === 0) return { data: [], error: null };

    const targetId = activeAgencyId && agencyIds.includes(activeAgencyId)
      ? activeAgencyId
      : agencyIds[0];

    query = query.eq('agency_id', targetId);
  }

  const { data, error } = await query.order('created_at');
  const mapped = (data || []).map((w) => ({
    ...w,
    logoUrl: w.agencies?.logo_url || null,
    agencies: undefined,
  }));
  return { data: error ? null : mapped, error };
}

export async function getWorkspace(id) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('workspaces')
    .select(`*`)
    .eq('id', id)
    .single();

  return { data, error };
}

export async function createWorkspace({ name, icon = '🚀' }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: 'Unauthorized', status: 401 } };

  // Fetch the user's agency_id and role
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('role, agency_id')
    .eq('id', user.id)
    .single();

  if (profileErr) return { data: null, error: profileErr };

  if (profile.role === 'member') {
    return { data: null, error: { message: 'Forbidden: Members cannot create workspaces', status: 403 } };
  }

  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({
      name,
      icon,
      agency_id: profile.agency_id
    })
    .select()
    .single();

  return { data: workspace, error: wsError };
}

export async function updateWorkspace(id, updates) {
  const supabase = await createClient();
  const allowed = {};
  if (updates.name !== undefined)  allowed.name = updates.name;
  if (updates.icon !== undefined)  allowed.icon = updates.icon;

  const { data, error } = await supabase
    .from('workspaces')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function deleteWorkspace(id) {
  const supabase = await createClient();
  const { error } = await supabase.from('workspaces').delete().eq('id', id);
  return { error };
}

// ── Members ───────────────────────────────────────────────

export async function listMembers(workspaceId) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('workspace_members')
    .select(`*, user:user_id(id, email, raw_user_meta_data)`)
    .eq('workspace_id', workspaceId)
    .order('joined_at');

  return { data, error };
}

export async function addMember(workspaceId, { userId, role = 'viewer' }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('workspace_members')
    .insert({ workspace_id: workspaceId, user_id: userId, role })
    .select()
    .single();

  return { data, error };
}

export async function updateMemberRole(workspaceId, userId, role) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('workspace_members')
    .update({ role })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .select()
    .single();

  return { data, error };
}

export async function removeMember(workspaceId, userId) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);

  return { error };
}

export async function createAgencyWorkspace({ name, icon = '🚀', agencyId }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('workspaces')
    .insert({ name, icon, agency_id: agencyId })
    .select()
    .single();
  return { data, error };
}

export async function seedWorkspace(workspaceId) {
  // Return empty success since we want workspaces to start clean without seeded pages
  return { error: null };
}

