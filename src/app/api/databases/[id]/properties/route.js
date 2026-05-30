import { ok, created, badRequest, fromSupabaseError } from '@/lib/api/response';
import { listProperties, createProperty, reorderProperties } from '@/lib/db/properties';

const VALID_TYPES = ['text', 'number', 'select', 'multi_select', 'date', 'checkbox', 'url', 'email', 'phone', 'relation', 'formula', 'rollup'];

export async function GET(_, { params }) {
  const { id } = await params;
  const { data, error } = await listProperties(id);
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function POST(request, { params }) {
  const { id: databaseId } = await params;
  const body = await request.json().catch(() => ({}));
  const { name, type, config, sortOrder } = body;

  if (!name?.trim())                  return badRequest('name is required');
  if (type && !VALID_TYPES.includes(type)) return badRequest(`type must be one of: ${VALID_TYPES.join(', ')}`);

  const { data, error } = await createProperty({ databaseId, name: name.trim(), type, config, sortOrder });
  if (error) return fromSupabaseError(error);
  return created(data);
}

// PATCH — batch reorder
export async function PATCH(request, { params }) {
  const { id: databaseId } = await params;
  const body = await request.json().catch(() => ({}));
  const { orderedIds } = body;

  if (!Array.isArray(orderedIds)) return badRequest('orderedIds must be an array');

  const { error } = await reorderProperties(databaseId, orderedIds);
  if (error) return fromSupabaseError(error);
  return ok({ reordered: true });
}
