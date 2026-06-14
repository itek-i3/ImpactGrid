const { createClient } = require('@supabase/supabase-js');
const http = require('http');

const supabaseUrl = 'https://wgelftngihceavdcwccs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZWxmdG5naWhjZWF2ZGN3Y2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMzc4NTYsImV4cCI6MjA5NTgxMzg1Nn0.m4mHi5ay1aBSD3axFxMrrBD6E7TxXpKpI2NgvzY2HRk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const email = `test-${Date.now()}@example.com`;
  const password = 'Password123!';

  console.log(`Signing up temporary user: ${email}`);
  
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

  console.log('Sign up successful. User ID:', signUpData.user.id);

  console.log('Logging in...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    console.error('Sign in failed:', signInError);
    return;
  }

  const session = signInData.session;
  console.log('Logged in successfully. Access token retrieved.');

  const cookieName = 'sb-wgelftngihceavdcwccs-auth-token';
  const cookieObj = [session.access_token, session.refresh_token];
  const cookieValue = Buffer.from(JSON.stringify(cookieObj)).toString('base64');

  console.log('Sending request to local Next.js server http://localhost:3000/os...');
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/os',
    method: 'GET',
    headers: {
      'Cookie': `${cookieName}=${cookieValue}`
    }
  };

  const req = http.request(options, (res) => {
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
