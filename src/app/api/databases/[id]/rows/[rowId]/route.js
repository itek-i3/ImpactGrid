import { ok, noContent, badRequest, fromSupabaseError } from '@/lib/api/response';
import { getRow, updateRow, archiveRow, restoreRow, deleteRow, duplicateRow } from '@/lib/db/rows';

export async function GET(_, { params }) {
  const { rowId } = await params;
  const { data, error } = await getRow(rowId);
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function PATCH(request, { params }) {
  const { rowId } = await params;
  const body = await request.json().catch(() => ({}));

  if (body.action === 'archive') {
    const { data, error } = await archiveRow(rowId);
    if (error) return fromSupabaseError(error);
    return ok(data);
  }

  if (body.action === 'restore') {
    const { data, error } = await restoreRow(rowId);
    if (error) return fromSupabaseError(error);
    return ok(data);
  }

  if (body.action === 'duplicate') {
    const { data, error } = await duplicateRow(rowId);
    if (error) return fromSupabaseError(error);
    return ok(data);
  }

  const { data, error } = await updateRow(rowId, body);
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function DELETE(_, { params }) {
  const { rowId } = await params;
  const { error } = await deleteRow(rowId);
  if (error) return fromSupabaseError(error);
  return noContent();
}
