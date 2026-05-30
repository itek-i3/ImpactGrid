import { ok, created, badRequest, fromSupabaseError } from '@/lib/api/response';
import { listRows, createRow } from '@/lib/db/rows';

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const archived = searchParams.get('archived') === 'true';
  const limit    = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000);
  const offset   = parseInt(searchParams.get('offset') || '0', 10);

  const { data, error, count } = await listRows(id, { archived, limit, offset });
  if (error) return fromSupabaseError(error);
  return ok({ rows: data, total: count, limit, offset });
}

export async function POST(request, { params }) {
  const { id: databaseId } = await params;
  const body = await request.json().catch(() => ({}));
  const { cells, sortOrder } = body;

  const { data, error } = await createRow({ databaseId, cells: cells ?? {}, sortOrder });
  if (error) return fromSupabaseError(error);
  return created(data);
}
