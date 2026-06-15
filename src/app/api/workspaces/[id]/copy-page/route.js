import { ok, badRequest, forbidden, fromSupabaseError } from '@/lib/api/response';
import { createClient, createAdminClient } from '@/lib/supabase/server';

async function copyPageToWorkspace(supabase, { sourcePageId, targetWorkspaceId, targetParentId = null, userId }) {
  // Fetch source page
  const { data: sourcePage, error: pageErr } = await supabase
    .from('pages')
    .select('*')
    .eq('id', sourcePageId)
    .single();
  if (pageErr) throw pageErr;

  // Insert new page in target workspace
  const { data: newPage, error: insertErr } = await supabase
    .from('pages')
    .insert({
      workspace_id: targetWorkspaceId,
      parent_id: targetParentId,
      title: sourcePage.title,
      icon: sourcePage.icon,
      sort_order: sourcePage.sort_order,
      created_by: userId,
    })
    .select('id')
    .single();
  if (insertErr) throw insertErr;

  // Copy blocks
  const { data: blocks } = await supabase
    .from('blocks')
    .select('*')
    .eq('page_id', sourcePageId)
    .order('sort_order', { ascending: true });

  if (blocks?.length) {
    const { error: blocksErr } = await supabase.from('blocks').insert(
      blocks.map(({ id: _id, page_id: _pid, created_at: _ca, updated_at: _ua, ...rest }) => ({
        ...rest,
        page_id: newPage.id,
      }))
    );
    if (blocksErr) throw blocksErr;
  }

  // Recursively copy child pages
  const { data: children } = await supabase
    .from('pages')
    .select('id')
    .eq('parent_id', sourcePageId)
    .eq('is_archived', false);

  if (children?.length) {
    for (const child of children) {
      await copyPageToWorkspace(supabase, {
        sourcePageId: child.id,
        targetWorkspaceId,
        targetParentId: newPage.id,
        userId,
      });
    }
  }

  return newPage.id;
}

export async function POST(request, { params }) {
  const { id: targetWorkspaceId } = await params;

  const authClient = await createClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return badRequest('Unauthorized');

  const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role === 'member') return forbidden('Only managers can copy pages');

  const body = await request.json().catch(() => ({}));
  const { pageId } = body;
  if (!pageId) return badRequest('pageId is required');

  const supabase = profile.role === 'superadmin' && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createAdminClient()
    : authClient;

  try {
    const newPageId = await copyPageToWorkspace(supabase, {
      sourcePageId: pageId,
      targetWorkspaceId,
      userId: user.id,
    });
    return ok({ pageId: newPageId });
  } catch (err) {
    console.error('copy-page error:', err);
    return fromSupabaseError(err);
  }
}
