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

  const admin = createAdminClient();

  // Resolve this workspace's agency — used for DM isolation
  const { data: wsRow } = await admin
    .from('workspaces')
    .select('agency_id')
    .eq('id', workspaceId)
    .single();
  const wsAgencyId = wsRow?.agency_id || null;

  // Secure DMs
  // Channel format: dm:agencyId:userId1:userId2 (4 parts)
  if (channel.startsWith('dm:')) {
    const parts = channel.split(':');
    // Reject channels that don't carry an agency prefix — they can't be isolated
    if (parts.length !== 4) return forbidden('Malformed DM channel');

    const channelAgencyId = parts[1];
    const u1 = parts[2];
    const u2 = parts[3];

    // Agency isolation: the channel's agency must match this workspace's agency
    if (wsAgencyId && channelAgencyId !== wsAgencyId) {
      return forbidden('DM does not belong to this agency');
    }

    const isParticipant = u1 === user.id || u2 === user.id;
    if (!isParticipant) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile?.role !== 'superadmin') {
        return forbidden('You do not have access to this conversation');
      }
    }
  }

  const selectCols = `id, message, channel, created_at, user_id, profiles:user_id (full_name, email, role)`;

  // DMs: filter only by channel (agency already encoded in channel name + validated above)
  // Group channels: filter by workspace_id as usual
  let query = channel.startsWith('dm:')
    ? admin.from('chat_messages').select(selectCols).eq('channel', channel)
    : admin.from('chat_messages').select(selectCols).eq('workspace_id', workspaceId).eq('channel', channel);

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
  
  const isValidChannel = VALID_CHANNELS.includes(channel) || channel.startsWith('dm:');
  if (!isValidChannel) return badRequest('invalid channel');

  // DM channels: agency isolation + participant check
  if (channel.startsWith('dm:')) {
    const parts = channel.split(':');
    if (parts.length !== 4) return badRequest('Malformed DM channel');

    const channelAgencyId = parts[1];
    const u1 = parts[2];
    const u2 = parts[3];

    // Reject if the channel's agency doesn't match this workspace's agency
    const { data: wsCheck } = await createAdminClient()
      .from('workspaces')
      .select('agency_id')
      .eq('id', workspaceId)
      .single();
    if (wsCheck?.agency_id && channelAgencyId !== wsCheck.agency_id) {
      return forbidden('DM does not belong to this agency');
    }

    const isParticipant = u1 === user.id || u2 === user.id;
    if (!isParticipant) {
      return forbidden('You can only post in DMs you are a participant of');
    }
  } else {
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

  const isValidChannel = VALID_CHANNELS.includes(channel) || channel.startsWith('dm:');
  if (!isValidChannel) return badRequest('invalid channel');

  if (channel.startsWith('dm:')) {
    const parts = channel.split(':');
    const u1 = parts.length === 4 ? parts[2] : parts[1];
    const u2 = parts.length === 4 ? parts[3] : parts[2];
    if (u1 !== user.id && u2 !== user.id) return forbidden('You do not have access to this conversation');
  } else {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || profile.role === 'member') return forbidden('Only managers can clear chat');
  }

  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('channel', channel);

  if (error) return fromSupabaseError(error);
  return noContent();
}
