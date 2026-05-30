import { createClient } from '@/lib/supabase/server';

export async function listViews(databaseId) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('database_views')
    .select('*')
    .eq('database_id', databaseId)
    .order('sort_order');

  return { data, error };
}

export async function getView(id) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('database_views')
    .select('*')
    .eq('id', id)
    .single();

  return { data, error };
}

export async function createView({ databaseId, name, type = 'table', config = {}, sortOrder }) {
  const supabase = await createClient();

  if (sortOrder === undefined) {
    const { count } = await supabase
      .from('database_views')
      .select('id', { count: 'exact', head: true })
      .eq('database_id', databaseId);
    sortOrder = count ?? 0;
  }

  const { data, error } = await supabase
    .from('database_views')
    .insert({ database_id: databaseId, name, type, config, sort_order: sortOrder })
    .select()
    .single();

  return { data, error };
}

export async function updateView(id, updates) {
  const supabase = await createClient();
  const allowed = {};
  if (updates.name       !== undefined) allowed.name       = updates.name;
  if (updates.config     !== undefined) allowed.config     = updates.config;
  if (updates.sort_order !== undefined) allowed.sort_order = updates.sort_order;

  const { data, error } = await supabase
    .from('database_views')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function deleteView(id) {
  const supabase = await createClient();
  const { error } = await supabase.from('database_views').delete().eq('id', id);
  return { error };
}
