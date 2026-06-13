import { createClient } from '@/lib/supabase/server';

export async function listPages(workspaceId, { archived = false } = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pages')
    .select('id, title, icon, cover_url, parent_id, is_database, database_type, is_archived, is_favorite, is_public, sort_order, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .eq('is_archived', archived)
    .order('sort_order');

  return { data, error };
}

export async function getPage(id) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pages')
    .select('*')
    .eq('id', id)
    .single();

  return { data, error };
}

export async function createPage({ workspaceId, parentId = null, title = 'Untitled', icon = '📄', isDatabase = false, databaseType = null, sortOrder = 0, isFavorite = false }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('pages')
    .insert({
      workspace_id: workspaceId,
      parent_id: parentId,
      title,
      icon,
      is_database: isDatabase,
      database_type: databaseType,
      sort_order: sortOrder,
      is_favorite: isFavorite,
      created_by: user?.id ?? null,
    })
    .select()
    .single();

  return { data, error };
}

export async function updatePage(id, updates) {
  const supabase = await createClient();
  const allowed = {};
  const fields = ['title', 'icon', 'cover_url', 'parent_id', 'is_public', 'sort_order', 'is_favorite'];
  fields.forEach((f) => {
    if (updates[f] !== undefined) {
      allowed[f] = updates[f];
    } else if (f === 'is_favorite' && updates.isFavorite !== undefined) {
      allowed.is_favorite = updates.isFavorite;
    }
  });

  const { data, error } = await supabase
    .from('pages')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function archivePage(id) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pages')
    .update({ is_archived: true, archived_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function restorePage(id) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pages')
    .update({ is_archived: false, archived_at: null })
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function deletePage(id) {
  const supabase = await createClient();
  const { error } = await supabase.from('pages').delete().eq('id', id);
  return { error };
}

export async function reorderPages(workspaceId, orderedIds) {
  const supabase = await createClient();
  const promises = orderedIds.map((id, index) =>
    supabase
      .from('pages')
      .update({ sort_order: index })
      .eq('id', id)
  );
  const results = await Promise.all(promises);
  const error = results.find((r) => r.error)?.error || null;
  return { error };
}
