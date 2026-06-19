import { ok, created, noContent, badRequest, forbidden, fromSupabaseError } from '@/lib/api/response';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const VALID_CHANNELS = ['daily_tasks', 'weekly_tasks', 'random'];
const MANAGER_ONLY_CHANNELS = ['weekly_tasks'];

export async function GET(request, { params }) {
  const { id: workspaceId } = await params;
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel') || 'random';
  const messageId = searchParams.get('messageId');

  // Auth check via session client
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return badRequest('Unauthorized');

  // Use admin client so profiles join always works regardless of RLS
  const admin = createAdminClient();
  let query = admin
    .from('chat_messages')
    .select(`
      id,
      message,
      channel,
      created_at,
      user_id,
      profiles:user_id (
        full_name,
        email,
        role
      )
    `)
    .eq('workspace_id', workspaceId)
    .eq('channel', channel);

  if (messageId) {
    query = query.eq('id', messageId);
  } else {
    query = query.order('created_at', { ascending: true });
  }

  const { data, error } = await query;

  if (error) return fromSupabaseError(error);

  const formatted = (data || []).map((msg) => ({
    id: msg.id,
    message: msg.message,
    channel: msg.channel,
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

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return badRequest('Unauthorized');

  const body = await request.json().catch(() => ({}));
  const { message, channel = 'random' } = body;

  if (!message || message.trim() === '') return badRequest('message is required');
  if (!VALID_CHANNELS.includes(channel)) return badRequest('invalid channel');

  // Weekly tasks: only managers and superadmins can post
  if (MANAGER_ONLY_CHANNELS.includes(channel)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role === 'member') {
      return forbidden('Only managers can post in Weekly Tasks');
    }
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      workspace_id: workspaceId,
      user_id: user.id,
      message: message.trim(),
      channel,
    })
    .select(`
      id,
      message,
      channel,
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

  return created({
    id: data.id,
    message: data.message,
    channel: data.channel,
    createdAt: data.created_at,
    userId: data.user_id,
    userName: data.profiles?.full_name || 'Anonymous Member',
    userEmail: data.profiles?.email || '',
    userRole: data.profiles?.role || 'member',
  });
}

export async function DELETE(request, { params }) {
  const { id: workspaceId } = await params;
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel') || 'random';

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return badRequest('Unauthorized');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role === 'member') return forbidden('Only managers can clear chat');

  if (!VALID_CHANNELS.includes(channel)) return badRequest('invalid channel');

  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('channel', channel);

  if (error) return fromSupabaseError(error);
  return noContent();
}
