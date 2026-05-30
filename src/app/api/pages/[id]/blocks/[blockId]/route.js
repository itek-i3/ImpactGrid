import { ok, noContent, fromSupabaseError } from '@/lib/api/response';
import { updateBlock, deleteBlock } from '@/lib/db/blocks';

export async function PATCH(request, { params }) {
  const { blockId } = await params;
  const body = await request.json().catch(() => ({}));

  const { data, error } = await updateBlock(blockId, body);
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function DELETE(_, { params }) {
  const { blockId } = await params;
  const { error } = await deleteBlock(blockId);
  if (error) return fromSupabaseError(error);
  return noContent();
}
