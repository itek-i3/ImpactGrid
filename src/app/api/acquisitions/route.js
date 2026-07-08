import { ok, created, noContent, badRequest, fromSupabaseError } from '@/lib/api/response';
import { listAcquisitions, saveAcquisition, deleteAcquisition } from '@/lib/db/acquisitions';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const agencyId = searchParams.get('agencyId');
  if (!agencyId) return badRequest('agencyId is required');

  const { data, error } = await listAcquisitions(agencyId);
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { agencyId, evaluation } = body;
  if (!agencyId) return badRequest('agencyId is required');
  if (!evaluation || typeof evaluation !== 'object') return badRequest('evaluation is required');

  const { data, error } = await saveAcquisition(agencyId, evaluation);
  if (error) return fromSupabaseError(error);
  return created(data);
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const agencyId = searchParams.get('agencyId');
  const id = searchParams.get('id');
  if (!agencyId || !id) return badRequest('agencyId and id are required');

  const { error } = await deleteAcquisition(agencyId, id);
  if (error) return fromSupabaseError(error);
  return noContent();
}
