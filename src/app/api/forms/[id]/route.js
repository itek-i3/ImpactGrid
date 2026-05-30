import { ok, noContent, notFound, fromSupabaseError } from '@/lib/api/response';
import { getForm, updateForm, deleteForm, listSubmissions } from '@/lib/db/forms';

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  // GET /api/forms/[id]?submissions=true — fetch submissions instead
  if (searchParams.get('submissions') === 'true') {
    const limit  = parseInt(searchParams.get('limit')  || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0',   10);
    const { data, error, count } = await listSubmissions(id, { limit, offset });
    if (error) return fromSupabaseError(error);
    return ok({ submissions: data, total: count });
  }

  const { data, error } = await getForm(id);
  if (error) return fromSupabaseError(error);
  if (!data) return notFound('Form not found');
  return ok(data);
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const { data, error } = await updateForm(id, body);
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function DELETE(_, { params }) {
  const { id } = await params;
  const { error } = await deleteForm(id);
  if (error) return fromSupabaseError(error);
  return noContent();
}
