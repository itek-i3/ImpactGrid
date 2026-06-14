const { createServerClient } = require('@supabase/ssr');
const https = require('https');

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
      },
      user_metadata: {
        full_name: 'Test User',
        agency: 'i3x',
        role: 'member'
      }
    }
  );

  console.log('Signing in programmatically to get cookies...');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('Sign in failed:', error);
    return;
  }

  // Construct cookie header
  const cookieHeader = cookiesSet.map(c => `${c.name}=${c.value}`).join('; ');
  console.log('Sending request to Vercel production server https://impact-grid-kappa.vercel.app/os...');
  
  const options = {
    hostname: 'impact-grid-kappa.vercel.app',
    path: '/os',
    method: 'GET',
    headers: {
      'Cookie': cookieHeader
    }
  };

  const req = https.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log('Response Headers:', res.headers);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Response Body snippet (first 1000 chars):');
      console.log(data.substring(0, 1000));
      process.exit(0);
    });
  });

  req.on('error', (err) => {
    console.error('Request failed:', err);
    process.exit(1);
  });

  req.end();
}

run().catch(console.error);
