import { ok, noContent, fromSupabaseError } from '@/lib/api/response';
import { updateView, deleteView } from '@/lib/db/views';

export async function PATCH(request, { params }) {
  const { viewId } = await params;
  const body = await request.json().catch(() => ({}));

  const { data, error } = await updateView(viewId, body);
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function DELETE(_, { params }) {
  const { viewId } = await params;
  const { error } = await deleteView(viewId);
  if (error) return fromSupabaseError(error);
  return noContent();
}
