import { ok, badRequest, fromSupabaseError } from '@/lib/api/response';
import { globalSearch } from '@/lib/db/search';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  const query       = searchParams.get('q') || '';
  const limit       = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

  if (!workspaceId) return badRequest('workspaceId query param is required');
  if (!query.trim()) return ok({ pages: [], rows: [] });

  const { data, error } = await globalSearch(workspaceId, query, { limit });
  if (error) return fromSupabaseError(error);
  return ok(data);
}
