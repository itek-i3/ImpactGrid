import { ok, created, noContent, badRequest, forbidden, notFound, fromSupabaseError } from '@/lib/api/response';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { parseDmChannel, isDmParticipant } from '@/lib/chat/dmChannels';

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

  const admin = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase;

  // Resolve this workspace's agency — used for DM isolation
  const { data: wsRow } = await admin
    .from('workspaces')
    .select('agency_id')
    .eq('id', workspaceId)
    .single();
  const wsAgencyId = wsRow?.agency_id || null;

  // Secure DMs
  if (channel.startsWith('dm:')) {
    const dm = parseDmChannel(channel);
    if (!dm.isDm || dm.participants.length < 2) return forbidden('Malformed DM channel');

    const channelAgencyId = dm.agencyId;
    if (wsAgencyId && channelAgencyId && channelAgencyId !== wsAgencyId) {
      return forbidden('DM does not belong to this agency');
    }

    if (!isDmParticipant(channel, user.id)) {
      return forbidden('You do not have access to this conversation');
    }
  }

  const selectCols = `id, message, channel, created_at, edited, user_id, profiles:user_id (full_name, email, role)`;

  // DMs: filter only by channel (agency already encoded in channel name + validated above)
  // Group channels: filter by workspace_id as usual
  let query = channel.startsWith('dm:')
    ? supabase.from('chat_messages').select(selectCols).eq('channel', channel)
    : supabase.from('chat_messages').select(selectCols).eq('workspace_id', workspaceId).eq('channel', channel);

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
    edited: msg.edited || false,
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
    const dm = parseDmChannel(channel);
    if (!dm.isDm || dm.participants.length < 2) return badRequest('Malformed DM channel');

    const channelAgencyId = dm.agencyId;
    const admin = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase;
    const { data: wsCheck } = await admin
      .from('workspaces')
      .select('agency_id')
      .eq('id', workspaceId)
      .single();
    if (wsCheck?.agency_id && channelAgencyId && channelAgencyId !== wsCheck.agency_id) {
      return forbidden('DM does not belong to this agency');
    }

    if (!isDmParticipant(channel, user.id)) {
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
      edited,
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
    edited: data.edited || false,
    userId: data.user_id,
    userName: data.profiles?.full_name || 'Anonymous Member',
    userEmail: data.profiles?.email || '',
    userRole: data.profiles?.role || 'member',
  });
}

// Edit a single message. RLS lets only the author (or superadmin) update it.
export async function PATCH(request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return badRequest('Unauthorized');

  const body = await request.json().catch(() => ({}));
  const { messageId, message } = body;
  if (!messageId) return badRequest('messageId is required');
  if (!message || message.trim() === '') return badRequest('message is required');

  const { data, error } = await supabase
    .from('chat_messages')
    .update({ message: message.trim(), edited: true })
    .eq('id', messageId)
    .select(`
      id, message, channel, created_at, edited, user_id,
      profiles:user_id ( full_name, email, role )
    `)
    .maybeSingle();

  if (error) return fromSupabaseError(error);
  if (!data) return notFound('Message not found or you cannot edit it');

  return ok({
    id: data.id,
    message: data.message,
    channel: data.channel,
    createdAt: data.created_at,
    edited: data.edited || false,
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
  const messageId = searchParams.get('messageId');

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return badRequest('Unauthorized');

  // Single-message delete — RLS allows the author, or a manager/superadmin.
  if (messageId) {
    const { error } = await supabase.from('chat_messages').delete().eq('id', messageId);
    if (error) return fromSupabaseError(error);
    return noContent();
  }

  const isValidChannel = VALID_CHANNELS.includes(channel) || channel.startsWith('dm:');
  if (!isValidChannel) return badRequest('invalid channel');

  if (channel.startsWith('dm:')) {
    if (!isDmParticipant(channel, user.id)) return forbidden('You do not have access to this conversation');
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
