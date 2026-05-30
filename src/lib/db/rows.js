import { createClient } from '@/lib/supabase/server';

export async function listRows(databaseId, { archived = false, limit = 500, offset = 0 } = {}) {
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from('database_rows')
    .select('*', { count: 'exact' })
    .eq('database_id', databaseId)
    .eq('is_archived', archived)
    .order('sort_order')
    .range(offset, offset + limit - 1);

  return { data, error, count };
}

export async function getRow(id) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('database_rows')
    .select('*')
    .eq('id', id)
    .single();

  return { data, error };
}

export async function createRow({ databaseId, cells = {}, sortOrder }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (sortOrder === undefined) {
    const { count } = await supabase
      .from('database_rows')
      .select('id', { count: 'exact', head: true })
      .eq('database_id', databaseId)
      .eq('is_archived', false);
    sortOrder = count ?? 0;
  }

  const { data, error } = await supabase
    .from('database_rows')
    .insert({
      database_id: databaseId,
      cells,
      sort_order: sortOrder,
      created_by: user?.id ?? null,
    })
    .select()
    .single();

  return { data, error };
}

export async function updateRow(id, updates) {
  const supabase = await createClient();
  const allowed = {};
  if (updates.cells      !== undefined) allowed.cells      = updates.cells;
  if (updates.sort_order !== undefined) allowed.sort_order = updates.sort_order;

  const { data, error } = await supabase
    .from('database_rows')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

// Merge a single cell value into the row's JSONB cells
export async function updateCell(rowId, propertyId, value) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc('update_row_cell', { row_id: rowId, property_id: propertyId, cell_value: JSON.stringify(value) });

  if (error) {
    // Fallback: read-modify-write if the RPC doesn't exist yet
    const { data: row } = await supabase.from('database_rows').select('cells').eq('id', rowId).single();
    const cells = { ...(row?.cells ?? {}), [propertyId]: value };
    return updateRow(rowId, { cells });
  }

  return { data, error };
}

export async function archiveRow(id) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('database_rows')
    .update({ is_archived: true })
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function restoreRow(id) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('database_rows')
    .update({ is_archived: false })
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function deleteRow(id) {
  const supabase = await createClient();
  const { error } = await supabase.from('database_rows').delete().eq('id', id);
  return { error };
}

export async function duplicateRow(id) {
  const supabase = await createClient();
  const { data: original, error: fetchErr } = await supabase
    .from('database_rows')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr) return { data: null, error: fetchErr };

  const { data, error } = await supabase
    .from('database_rows')
    .insert({
      database_id: original.database_id,
      cells: original.cells,
      sort_order: original.sort_order + 1,
      created_by: original.created_by,
    })
    .select()
    .single();

  return { data, error };
}
