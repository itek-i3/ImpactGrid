import { ok, created, badRequest, fromSupabaseError } from '@/lib/api/response';
import { listBlocks, createBlock, reorderBlocks } from '@/lib/db/blocks';

export async function GET(_, { params }) {
  const { id } = await params;
  const { data, error } = await listBlocks(id);
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function POST(request, { params }) {
  const { id: pageId } = await params;
  const body = await request.json().catch(() => ({}));
  const { type, content, properties, parentBlockId, sortOrder } = body;

  if (!type) return badRequest('type is required');

  const { data, error } = await createBlock({ pageId, type, content, properties, parentBlockId, sortOrder });
  if (error) return fromSupabaseError(error);
  return created(data);
}

// PATCH /api/pages/[id]/blocks — batch reorder
export async function PATCH(request, { params }) {
  const { id: pageId } = await params;
  const body = await request.json().catch(() => ({}));
  const { orderedIds } = body;

  if (!Array.isArray(orderedIds)) return badRequest('orderedIds must be an array');

  const { error } = await reorderBlocks(pageId, orderedIds);
  if (error) return fromSupabaseError(error);
  return ok({ reordered: true });
}
