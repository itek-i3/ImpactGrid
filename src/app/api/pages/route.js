import { ok, created, badRequest, fromSupabaseError } from '@/lib/api/response';
import { listPages, createPage } from '@/lib/db/pages';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  const archived    = searchParams.get('archived') === 'true';

  if (!workspaceId) return badRequest('workspaceId query param is required');

  const { data, error } = await listPages(workspaceId, { archived });
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { workspaceId, parentId, title, icon, isDatabase, databaseType, sortOrder } = body;

  if (!workspaceId) return badRequest('workspaceId is required');

  const { data, error } = await createPage({
    workspaceId,
    parentId,
    title,
    icon,
    isDatabase,
    databaseType,
    sortOrder,
  });

  if (error) return fromSupabaseError(error);
  return created(data);
}
