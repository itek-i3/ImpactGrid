import { ok, created, forbidden, unauthorized, fromSupabaseError, badRequest } from '@/lib/api/response';
import { getUserProfile } from '@/lib/db/profiles';
import { createAgency } from '@/lib/db/agencies';
import { createAgencyWorkspace, seedWorkspace } from '@/lib/db/workspaces';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const { data: profile, error: profileError } = await getUserProfile();
  if (profileError) {
    if (profileError.status === 401) return unauthorized(profileError.message);
    return fromSupabaseError(profileError);
  }
  if (profile.role !== 'superadmin') {
    return forbidden('Forbidden: Superadmin access required');
  }

  // Use service role to bypass RLS and see all agencies
  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : await createClient();
  const { data: agencies, error: agError } = await supabase
    .from('agencies')
    .select(`
      *,
      profiles(id),
      workspaces(id, name)
    `)
    .order('name');

  if (agError) return fromSupabaseError(agError);

  const mappedAgencies = (agencies || []).map(agency => ({
    id: agency.id,
    name: agency.name,
    slug: agency.slug,
    logoUrl: agency.logo_url,
    createdAt: agency.created_at,
    memberCount: (agency.profiles || []).length,
    workspaceId: (agency.workspaces || [])[0]?.id || null,
  }));

  return ok(mappedAgencies);
}

export async function POST(request) {
  const { data: profile, error: profileError } = await getUserProfile();
  if (profileError) {
    if (profileError.status === 401) return unauthorized(profileError.message);
    return fromSupabaseError(profileError);
  }
  if (profile.role !== 'superadmin') {
    return forbidden('Forbidden: Superadmin access required');
  }

  const body = await request.json().catch(() => ({}));
  const { name, slug, logoUrl } = body;

  if (!name || !slug) return badRequest('Name and slug are required');

  // 1. Create the agency
  const { data: agency, error: agError } = await createAgency({ name, slug, logoUrl });
  if (agError) return fromSupabaseError(agError);

  // 2. Automatically create default workspace for this agency
  const { data: workspace, error: wsError } = await createAgencyWorkspace({
    name: `${name} Workspace`,
    icon: '🏢',
    agencyId: agency.id
  });

  if (wsError) return fromSupabaseError(wsError);

  // 3. Seed the default workspace
  const { error: seedError } = await seedWorkspace(workspace.id);
  if (seedError) return fromSupabaseError(seedError);

  return created(agency);
}
