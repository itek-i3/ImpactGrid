import { createClient } from '@/lib/supabase/server';

export async function getDatabase(id) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('databases')
    .select(`
      *,
      database_properties(* ORDER BY sort_order),
      database_views(* ORDER BY sort_order)
    `)
    .eq('id', id)
    .single();

  return { data, error };
}

export async function getDatabaseByPage(pageId) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('databases')
    .select(`
      *,
      database_properties(* ORDER BY sort_order),
      database_views(* ORDER BY sort_order)
    `)
    .eq('page_id', pageId)
    .single();

  return { data, error };
}

export async function createDatabase({ pageId, workspaceId, name, type = 'custom', description = null }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('databases')
    .insert({ page_id: pageId, workspace_id: workspaceId, name, type, description })
    .select()
    .single();

  return { data, error };
}

export async function updateDatabase(id, updates) {
  const supabase = await createClient();
  const allowed = {};
  if (updates.name        !== undefined) allowed.name        = updates.name;
  if (updates.description !== undefined) allowed.description = updates.description;

  const { data, error } = await supabase
    .from('databases')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function deleteDatabase(id) {
  const supabase = await createClient();
  const { error } = await supabase.from('databases').delete().eq('id', id);
  return { error };
}
