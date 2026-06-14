const { createClient } = require('@supabase/supabase-js');
const { createServerClient } = require('@supabase/ssr');

const supabaseUrl = 'https://wgelftngihceavdcwccs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZWxmdG5naWhjZWF2ZGN3Y2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMzc4NTYsImV4cCI6MjA5NTgxMzg1Nn0.m4mHi5ay1aBSD3axFxMrrBD6E7TxXpKpI2NgvzY2HRk';

// Set env vars
process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = supabaseAnonKey;

async function run() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const email = `test-${Date.now()}@example.com`;
  const password = 'Password123!';

  console.log(`Creating test user...`);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: 'Test User',
        agency: 'i3x',
        role: 'manager'
      }
    }
  });

  if (signUpError) {
    console.error('Sign up failed:', signUpError);
    return;
  }

  const userId = signUpData.user.id;
  console.log('User created:', userId);

  console.log('Logging in...');
  const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
  const session = signInData.session;

  // Now, let's see how cookies are retrieved by NextRequest.
  // NextRequest cookies are read using request.cookies.getAll().
  // Let's mock a simple cookie store.
  const cookieName = `sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;
  
  // Format for supabase-ssr:
  // Supabase SSR uses decodeURIComponent on the cookie.
  // The value is stored as a stringified JSON containing access_token, refresh_token, etc.
  const cookieData = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: signInData.user
  };
  
  const cookieValue = encodeURIComponent(JSON.stringify(cookieData));
  
  const mockCookies = [
    { name: cookieName, value: cookieValue }
  ];

  console.log('Initializing Server Client with mock cookies...');
  
  const srvSupabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return mockCookies;
        },
        setAll(cookiesToSet) {
          console.log('Cookies to set:', cookiesToSet);
        }
      }
    }
  );

  console.log('Calling srvSupabase.auth.getUser()...');
  const { data: { user }, error } = await srvSupabase.auth.getUser();
  
  if (error) {
    console.error('auth.getUser() failed:', error);
  } else {
    console.log('auth.getUser() succeeded! User email:', user.email);
  }
}

run().catch(console.error);
