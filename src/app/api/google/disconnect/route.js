import { ok, badRequest } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';

// Forget this user's Google tokens. New meetings fall back to the manual link.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return badRequest('Unauthorized');

  await supabase.from('google_credentials').delete().eq('user_id', user.id);
  return ok({ ok: true });
}
