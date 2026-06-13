import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import WorkspaceWrapper from './WorkspaceWrapper';

const BASE = '/os';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(BASE + '/login');
  }

  return <WorkspaceWrapper />;
}
