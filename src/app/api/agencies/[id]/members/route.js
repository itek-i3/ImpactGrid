import { ok, created, noContent, badRequest, forbidden, fromSupabaseError } from '@/lib/api/response';
import { getUserProfile } from '@/lib/db/profiles';
import { listAgencyMembers, addAgencyMember, removeAgencyMember } from '@/lib/db/agencies';

async function requireAdminOrAbove() {
  const { data: profile, error } = await getUserProfile();
  if (error) return { error: fromSupabaseError(error) };
  if (!['superadmin', 'manager', 'admin'].includes(profile?.role)) {
    return { error: forbidden('Admin access required') };
  }
  return { profile };
}

export async function GET(_, { params }) {
  const { id } = await params;
  const { error: authError } = await requireAdminOrAbove();
  if (authError) return authError;

  const { data, error } = await listAgencyMembers(id);
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { error: authError } = await requireAdminOrAbove();
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const { userId, role = 'member' } = body;
  if (!userId) return badRequest('userId is required');

  const { data, error } = await addAgencyMember(id, userId, role);
  if (error) return fromSupabaseError(error);
  return created(data);
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { error: authError } = await requireAdminOrAbove();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) return badRequest('userId query param is required');

  const { error } = await removeAgencyMember(id, userId);
  if (error) return fromSupabaseError(error);
  return noContent();
}
