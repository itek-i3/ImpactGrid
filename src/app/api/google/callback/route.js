import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRedirectUri, exchangeCode, emailFromIdToken } from '@/lib/google/oauth';

// Google redirects here after consent. Exchange the code for tokens, store them,
// then bounce back to the Meetings tab.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const cookieState = request.cookies.get('g_oauth_state')?.value;

  const back = (status) => {
    const res = NextResponse.redirect(new URL(`/os/?meet=${status}`, request.url));
    res.cookies.delete('g_oauth_state');
    return res;
  };

  if (!code || !state || state !== cookieState) return back('error');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/os/login', request.url));

  try {
    const tokens = await exchangeCode(code, getRedirectUri(request));
    const expiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    const payload = {
      user_id: user.id,
      email: emailFromIdToken(tokens.id_token),
      access_token: tokens.access_token,
      token_expiry: expiry,
      scope: tokens.scope,
      updated_at: new Date().toISOString(),
    };
    // Google only returns refresh_token on the first consent — keep the old one otherwise.
    if (tokens.refresh_token) payload.refresh_token = tokens.refresh_token;

    await supabase.from('google_credentials').upsert(payload, { onConflict: 'user_id' });
    return back('connected');
  } catch (e) {
    console.error('[google/callback]', e);
    return back('error');
  }
}
