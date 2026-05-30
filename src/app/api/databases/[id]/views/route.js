import { ok, created, badRequest, fromSupabaseError } from '@/lib/api/response';
import { listViews, createView } from '@/lib/db/views';

const VALID_TYPES = ['table', 'kanban', 'calendar', 'list', 'timeline', 'gallery', 'chart', 'dashboard'];

export async function GET(_, { params }) {
  const { id } = await params;
  const { data, error } = await listViews(id);
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function POST(request, { params }) {
  const { id: databaseId } = await params;
  const body = await request.json().catch(() => ({}));
  const { name, type, config, sortOrder } = body;

  if (!name?.trim()) return badRequest('name is required');
  if (type && !VALID_TYPES.includes(type)) return badRequest(`type must be one of: ${VALID_TYPES.join(', ')}`);

  const { data, error } = await createView({ databaseId, name: name.trim(), type, config, sortOrder });
  if (error) return fromSupabaseError(error);
  return created(data);
}
