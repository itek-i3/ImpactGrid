import { ok, created, badRequest, fromSupabaseError } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';

export async function GET(request, { params }) {
  const { id: workspaceId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('chat_messages')
    .select(`
      id,
      message,
      created_at,
      user_id,
      profiles:user_id (
        full_name,
        email,
        role
      )
    `)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  if (error) return fromSupabaseError(error);
  
  // Format response data to make it cleaner
  const formatted = (data || []).map((msg) => ({
    id: msg.id,
    message: msg.message,
    createdAt: msg.created_at,
    userId: msg.user_id,
    userName: msg.profiles?.full_name || 'Anonymous Member',
    userEmail: msg.profiles?.email || '',
    userRole: msg.profiles?.role || 'member',
  }));

  return ok(formatted);
}

export async function POST(request, { params }) {
  const { id: workspaceId } = await params;
  const supabase = await createClient();
  
  // Get current user auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return badRequest('Unauthorized');
  }

  const body = await request.json().catch(() => ({}));
  const { message } = body;

  if (!message || message.trim() === '') {
    return badRequest('message is required');
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      workspace_id: workspaceId,
      user_id: user.id,
      message: message.trim(),
    })
    .select(`
      id,
      message,
      created_at,
      user_id,
      profiles:user_id (
        full_name,
        email,
        role
      )
    `)
    .single();

  if (error) return fromSupabaseError(error);
  
  const formatted = {
    id: data.id,
    message: data.message,
    createdAt: data.created_at,
    userId: data.user_id,
    userName: data.profiles?.full_name || 'Anonymous Member',
    userEmail: data.profiles?.email || '',
    userRole: data.profiles?.role || 'member',
  };

  return created(formatted);
}
