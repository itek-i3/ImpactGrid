import { ok, created, noContent, badRequest, forbidden, notFound, fromSupabaseError } from '@/lib/api/response';
import { getUserProfile } from '@/lib/db/profiles';
import { listAgencyMembers, addAgencyMember, removeAgencyMember } from '@/lib/db/agencies';
import { createAdminClient } from '@/lib/supabase/server';

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
  let { userId, email, role = 'member' } = body;
  if (!userId && !email) return badRequest('userId or email is required');

  // Agency membership only ever grants 'member' or 'manager' here — granting
  // 'superadmin' is a separate, global decision made in the admin panel, not
  // something this per-agency endpoint should be able to hand out.
  if (!['member', 'manager'].includes(role)) return badRequest("role must be 'member' or 'manager'");

  if (!userId) {
    const admin = createAdminClient();
    const { data: match, error: lookupErr } = await admin
      .from('profiles')
      .select('id')
      .ilike('email', email.trim())
      .maybeSingle();
    if (lookupErr) return fromSupabaseError(lookupErr);
    if (!match) return notFound('No account found for that email — they need to sign in once before you can grant manager access.');
    userId = match.id;
  }

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
