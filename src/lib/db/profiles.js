import { createClient } from '@/lib/supabase/server';

export async function getUserProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: 'Unauthorized', status: 401 } };

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      agency:agency_id(id, slug, name, logo_url)
    `)
    .eq('id', user.id)
    .single();

  return { data, error };
}
