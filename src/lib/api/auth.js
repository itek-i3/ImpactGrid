import { createClient } from '@/lib/supabase/server';
import { unauthorized } from './response';

// Returns { user } or throws a 401 NextResponse
export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw unauthorized();
  return { user, supabase };
}
