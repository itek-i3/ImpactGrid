import { createClient } from '@/lib/supabase/server';

export async function globalSearch(workspaceId, query, { limit = 20 } = {}) {
  const supabase = await createClient();
  const q = query.trim();
  if (!q) return { data: { pages: [], rows: [] }, error: null };

  const pattern = `%${q}%`;

  // Search pages by title
  const { data: pages, error: pagesErr } = await supabase
    .from('pages')
    .select('id, title, icon, is_database, database_type, parent_id, updated_at')
    .eq('workspace_id', workspaceId)
    .eq('is_archived', false)
    .ilike('title', pattern)
    .limit(limit);

  if (pagesErr) return { data: null, error: pagesErr };

  // Search database rows via JSONB text cast — finds matches anywhere in cell values
  const { data: rows, error: rowsErr } = await supabase
    .from('database_rows')
    .select(`
      id, cells, database_id, updated_at,
      databases!inner(id, name, workspace_id, page_id)
    `)
    .eq('databases.workspace_id', workspaceId)
    .eq('is_archived', false)
    .filter('cells::text', 'ilike', pattern)
    .limit(limit);

  if (rowsErr) return { data: null, error: rowsErr };

  return {
    data: { pages: pages ?? [], rows: rows ?? [] },
    error: null,
  };
}
