const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wgelftngihceavdcwccs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZWxmdG5naWhjZWF2ZGN3Y2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMzc4NTYsImV4cCI6MjA5NTgxMzg1Nn0.m4mHi5ay1aBSD3axFxMrrBD6E7TxXpKpI2NgvzY2HRk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const email = 'test-1781372381349@example.com';
  const password = 'Password123!';

  console.log('Logging in...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error('Auth failed:', authError);
    return;
  }

  const user = authData.user;
  console.log('Logged in successfully. User ID:', user.id);

  console.log('\n--- 0. Querying all agencies ---');
  const { data: agencies, error: agenciesErr } = await supabase
    .from('agencies')
    .select('*');
  console.log('Agencies:', agencies);
  console.error('Agencies Error:', agenciesErr);

  console.log('\n--- 1. Querying profile ---');
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('role, agency_id')
    .eq('id', user.id)
    .single();

  console.log('Profile:', profile);
  console.error('Profile Error:', profileErr);

  if (profileErr) {
    return;
  }

  console.log('\n--- 2. Listing workspaces ---');
  let query = supabase.from('workspaces').select('*');

  if (profile.role !== 'superadmin') {
    if (!profile.agency_id) {
      console.log('Profile has no agency_id. Returning early with empty data (matching listWorkspaces logic).');
    } else {
      query = query.eq('agency_id', profile.agency_id);
    }
  }

  const { data: workspaces, error: wsError } = await query.order('created_at');
  console.log('Workspaces list:', workspaces);
  console.error('Workspaces list Error:', wsError);

  console.log('\n--- 3. Attempting to insert a workspace ---');
  const insertPayload = {
    name: 'Personal Workspace',
    icon: '🚀',
    agency_id: profile.agency_id
  };
  console.log('Insert payload:', insertPayload);
  const { data: insertedWs, error: insertError } = await supabase
    .from('workspaces')
    .insert(insertPayload)
    .select()
    .single();

  console.log('Inserted workspace result:', insertedWs);
  console.error('Inserted workspace Error:', insertError);
}

run().catch(console.error);
