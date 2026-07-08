import { ok } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { googleConfigured } from '@/lib/google/oauth';

// Tells the client whether Google is configured server-side and whether THIS
// user has connected their account (so the UI can show connect/disconnect).
export async function GET() {
  const configured = googleConfigured();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ok({ configured, connected: false, email: null });

  const { data } = await supabase
    .from('google_credentials')
    .select('email, refresh_token')
    .eq('user_id', user.id)
    .maybeSingle();

  return ok({ configured, connected: Boolean(data?.refresh_token), email: data?.email || null });
}
