import { createClient } from '@/lib/supabase/server';

export async function listBlocks(pageId) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blocks')
    .select('*')
    .eq('page_id', pageId)
    .order('sort_order');

  return { data, error };
}

export async function getBlock(id) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blocks')
    .select('*')
    .eq('id', id)
    .single();

  return { data, error };
}

export async function createBlock({ pageId, type, content = {}, properties = {}, parentBlockId = null, sortOrder = 0 }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blocks')
    .insert({
      page_id: pageId,
      parent_block_id: parentBlockId,
      type,
      content,
      properties,
      sort_order: sortOrder,
    })
    .select()
    .single();

  return { data, error };
}

export async function updateBlock(id, updates) {
  const supabase = await createClient();
  const allowed = {};
  if (updates.content    !== undefined) allowed.content    = updates.content;
  if (updates.properties !== undefined) allowed.properties = updates.properties;
  if (updates.type       !== undefined) allowed.type       = updates.type;
  if (updates.sort_order !== undefined) allowed.sort_order = updates.sort_order;
  if (updates.parent_block_id !== undefined) allowed.parent_block_id = updates.parent_block_id;

  const { data, error } = await supabase
    .from('blocks')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function deleteBlock(id) {
  const supabase = await createClient();
  const { error } = await supabase.from('blocks').delete().eq('id', id);
  return { error };
}

// Batch-reorder blocks within a page
export async function reorderBlocks(pageId, orderedIds) {
  const supabase = await createClient();
  const promises = orderedIds.map((id, index) =>
    supabase
      .from('blocks')
      .update({ sort_order: index })
      .eq('id', id)
  );
  const results = await Promise.all(promises);
  const error = results.find((r) => r.error)?.error || null;
  return { error };
}
