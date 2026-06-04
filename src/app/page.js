import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listWorkspaces, createWorkspace } from '@/lib/db/workspaces';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: workspaces, error: listError } = await listWorkspaces();

  if (workspaces && workspaces.length > 0) {
    redirect(`/${workspaces[0].id}`);
  }

  // Create default workspace if none exists
  const { data: newWorkspace, error: createError } = await createWorkspace({
    name: 'Personal Workspace',
    icon: '🚀',
  });

  if (newWorkspace) {
    redirect(`/${newWorkspace.id}`);
  }

  // If we get here, the user is authenticated but workspace operations failed.
  // Don't redirect to /login — that causes an infinite loop since middleware
  // redirects authenticated users from /login back to /.
  console.error('[Home] listWorkspaces error:', JSON.stringify(listError, null, 2));
  console.error('[Home] createWorkspace error:', JSON.stringify(createError, null, 2));
  const errorMsg = createError?.message || listError?.message || 'Unknown error';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Unable to load workspace</h1>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        There was a problem setting up your workspace. This usually means the database tables
        haven&apos;t been created yet.
      </p>
      <p style={{ color: '#999', fontSize: '0.875rem', fontFamily: 'monospace', background: '#f5f5f5', padding: '0.75rem 1rem', borderRadius: '6px' }}>
        {errorMsg}
      </p>
      <p style={{ marginTop: '1.5rem', color: '#666', fontSize: '0.875rem' }}>
        Make sure you&apos;ve run the Supabase migration (<code>supabase/migrations/20260531000000_init.sql</code>) on your database.
      </p>
    </div>
  );
}
