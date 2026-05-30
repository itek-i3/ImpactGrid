import { ok, noContent, notFound, badRequest, fromSupabaseError } from '@/lib/api/response';
import { getPage, updatePage, archivePage, restorePage, deletePage } from '@/lib/db/pages';

export async function GET(_, { params }) {
  const { id } = await params;
  const { data, error } = await getPage(id);
  if (error) return fromSupabaseError(error);
  if (!data) return notFound('Page not found');
  return ok(data);
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  // Handle archive/restore as a special action
  if (body.action === 'archive') {
    const { data, error } = await archivePage(id);
    if (error) return fromSupabaseError(error);
    return ok(data);
  }

  if (body.action === 'restore') {
    const { data, error } = await restorePage(id);
    if (error) return fromSupabaseError(error);
    return ok(data);
  }

  const { data, error } = await updatePage(id, body);
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function DELETE(_, { params }) {
  const { id } = await params;
  const { error } = await deletePage(id);
  if (error) return fromSupabaseError(error);
  return noContent();
}
