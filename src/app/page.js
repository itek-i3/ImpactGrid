import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listWorkspaces, createWorkspace } from '@/lib/db/workspaces';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: workspaces } = await listWorkspaces();

  if (workspaces && workspaces.length > 0) {
    redirect(`/${workspaces[0].id}`);
  }

  // Create default workspace if none exists
  const { data: newWorkspace } = await createWorkspace({
    name: 'Personal Workspace',
    icon: '🚀',
  });

  if (newWorkspace) {
    redirect(`/${newWorkspace.id}`);
  }

  redirect('/login');
}
