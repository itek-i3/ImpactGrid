import { createClient } from '@/lib/supabase/server';

export async function listWorkspaces() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: 'Unauthorized', status: 401 } };

  const { data, error } = await supabase
    .from('workspaces')
    .select(`
      *,
      workspace_members!inner(role)
    `)
    .eq('workspace_members.user_id', user.id)
    .order('created_at');

  return { data, error };
}

export async function getWorkspace(id) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('workspaces')
    .select(`*, workspace_members(user_id, role)`)
    .eq('id', id)
    .single();

  return { data, error };
}

export async function createWorkspace({ name, icon = '🚀' }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: 'Unauthorized', status: 401 } };

  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({ name, icon, owner_id: user.id })
    .select()
    .single();

  if (wsError) return { data: null, error: wsError };

  // Add the creator as owner
  await supabase.from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: 'owner',
  });

  return { data: workspace, error: null };
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
