import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// next/navigation redirect() does not prepend basePath automatically,
// so we include /os explicitly here.
const BASE = '/os';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(BASE + '/login');
  }

  redirect(`${BASE}/demo`);
}
