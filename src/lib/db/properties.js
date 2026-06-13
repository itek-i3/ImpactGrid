import { createClient } from '@/lib/supabase/server';

export async function listProperties(databaseId) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('database_properties')
    .select('*')
    .eq('database_id', databaseId)
    .order('sort_order');

  return { data, error };
}

export async function getProperty(id) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('database_properties')
    .select('*')
    .eq('id', id)
    .single();

  return { data, error };
}

export async function createProperty({ databaseId, name, type = 'text', config = {}, sortOrder }) {
  const supabase = await createClient();

  // Default sortOrder: count + 1
  if (sortOrder === undefined) {
    const { count } = await supabase
      .from('database_properties')
      .select('id', { count: 'exact', head: true })
      .eq('database_id', databaseId);
    sortOrder = count ?? 0;
  }

  const { data, error } = await supabase
    .from('database_properties')
    .insert({ database_id: databaseId, name, type, config, sort_order: sortOrder })
    .select()
    .single();

  return { data, error };
}

export async function updateProperty(id, updates) {
  const supabase = await createClient();
  const allowed = {};
  if (updates.name       !== undefined) allowed.name       = updates.name;
  if (updates.config     !== undefined) allowed.config     = updates.config;
  if (updates.sort_order !== undefined) allowed.sort_order = updates.sort_order;

  const { data, error } = await supabase
    .from('database_properties')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function deleteProperty(id) {
  const supabase = await createClient();
  const { error } = await supabase.from('database_properties').delete().eq('id', id);
  return { error };
}

export async function reorderProperties(databaseId, orderedIds) {
  const supabase = await createClient();
  const promises = orderedIds.map((id, index) =>
    supabase
      .from('database_properties')
      .update({ sort_order: index })
      .eq('id', id)
  );
  const results = await Promise.all(promises);
  const error = results.find((r) => r.error)?.error || null;
  return { error };
}
