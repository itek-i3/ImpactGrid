import { createClient, createAdminClient } from '@/lib/supabase/server';
import { clientForUser } from './clientForUser';

export async function listBlocks(pageId) {
  // Use admin client so RLS doesn't block blocks on pages in secondary agencies
  const admin = createAdminClient();
  const { data, error } = await admin
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

export async function createBlock({ id, pageId, type, content = {}, properties = {}, parentBlockId = null, sortOrder = 0 }) {
  const { supabase } = await clientForUser();
  const insertData = {
    page_id: pageId,
    parent_block_id: parentBlockId,
    type,
    content,
    properties,
    sort_order: sortOrder,
  };

  if (id) {
    insertData.id = id;
  }

  const { data, error } = await supabase
    .from('blocks')
    .insert(insertData)
    .select()
    .single();

  return { data, error };
}

export async function updateBlock(id, updates) {
  const { supabase } = await clientForUser();
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
  const { supabase } = await clientForUser();
  const { error } = await supabase.from('blocks').delete().eq('id', id);
  return { error };
}

// Batch-reorder blocks within a page
export async function reorderBlocks(pageId, orderedIds) {
  const { supabase } = await clientForUser();
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
