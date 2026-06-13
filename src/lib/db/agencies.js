import { createClient } from '@/lib/supabase/server';

export async function listAgencies() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('agencies')
    .select('*')
    .order('name');
  return { data, error };
}

export async function createAgency({ name, slug, logoUrl = null }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('agencies')
    .insert({ name, slug, logo_url: logoUrl })
    .select()
    .single();
  return { data, error };
}
