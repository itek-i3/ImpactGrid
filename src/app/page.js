import { redirect } from 'next/navigation';

/**
 * Root page — redirects to login for now.
 * When Supabase is connected, this will check auth state
 * and redirect to the user's workspace or login.
 */
export default function Home() {
  redirect('/login');
}
