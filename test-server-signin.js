const { createServerClient } = require('@supabase/ssr');

const supabaseUrl = 'https://wgelftngihceavdcwccs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZWxmdG5naWhjZWF2ZGN3Y2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMzc4NTYsImV4cCI6MjA5NTgxMzg1Nn0.m4mHi5ay1aBSD3axFxMrrBD6E7TxXpKpI2NgvzY2HRk';

async function run() {
  const email = 'test-1781372381349@example.com';
  const password = 'Password123!';

  const cookiesSet = [];

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll(cookiesToSet) {
          cookiesSet.push(...cookiesToSet);
        }
      }
    }
  );

  console.log('Signing in...');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('Sign in failed:', error);
    return;
  }

  console.log('Sign in succeeded! Session user ID:', data.user.id);
  console.log('Cookies set in setAll:');
  console.dir(cookiesSet, { depth: null });
}

run().catch(console.error);
