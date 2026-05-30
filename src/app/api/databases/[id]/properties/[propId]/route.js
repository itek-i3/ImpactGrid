import { ok, noContent, fromSupabaseError } from '@/lib/api/response';
import { updateProperty, deleteProperty } from '@/lib/db/properties';

export async function PATCH(request, { params }) {
  const { propId } = await params;
  const body = await request.json().catch(() => ({}));

  const { data, error } = await updateProperty(propId, body);
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function DELETE(_, { params }) {
  const { propId } = await params;
  const { error } = await deleteProperty(propId);
  if (error) return fromSupabaseError(error);
  return noContent();
}
