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

export async function createBlock({ pageId, type, content = {}, parentBlockId = null, sortOrder = 0 }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blocks')
    .insert({
      page_id: pageId,
      parent_block_id: parentBlockId,
      type,
      content,
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
  const updates = orderedIds.map((id, index) => ({ id, page_id: pageId, sort_order: index }));
  const { error } = await supabase
    .from('blocks')
    .upsert(updates, { onConflict: 'id' });

  return { error };
}
