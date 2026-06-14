import { createClient, createAdminClient } from '@/lib/supabase/server';

/**
 * Returns { supabase, userId }.
 * Superadmins get the service-role client (bypasses RLS) so they can
 * read/write pages and blocks across any agency's workspace.
 */
export async function clientForUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, userId: null };

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'superadmin') {
      return { supabase: createAdminClient(), userId: user.id };
    }
  }

  return { supabase, userId: user.id };
}
