import { ok, created, noContent, badRequest, forbidden, notFound, fromSupabaseError } from '@/lib/api/response';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { parseDmChannel, isDmParticipant } from '@/lib/chat/dmChannels';
import { sendPushToUsers } from '@/lib/push/send';

const VALID_CHANNELS = ['daily_tasks', 'weekly_tasks', 'random'];
const GROUP_CHANNEL_NAMES = { daily_tasks: 'Daily Tasks', weekly_tasks: 'Weekly Tasks', random: 'Random' };
const MANAGER_ONLY_CHANNELS = ['weekly_tasks'];

// Who should be notified about a new message (everyone in the agency for a group
// channel, the other participant for a DM) — minus the sender.
async function pushRecipients(admin, workspaceId, channel, senderId) {
  if (channel.startsWith('dm:')) {
    const dm = parseDmChannel(channel);
    return (dm.participants || []).filter((id) => id && id !== senderId);
  }
  const { data: ws } = await admin.from('workspaces').select('agency_id').eq('id', workspaceId).single();
  if (!ws?.agency_id) return [];
  const [profs, mems] = await Promise.all([
    admin.from('profiles').select('id').eq('agency_id', ws.agency_id),
    admin.from('agency_members').select('user_id').eq('agency_id', ws.agency_id),
  ]);
  const set = new Set();
  (profs.data || []).forEach((p) => set.add(p.id));
  (mems.data || []).forEach((m) => set.add(m.user_id));
  set.delete(senderId);
  return [...set];
}

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

  const selectCols = `id, message, channel, created_at, edited, user_id, attachments, profiles:user_id (full_name, email, role)`;

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

  // Resolve sender identities via admin. The embedded profiles join above runs
  // under profiles RLS, which only exposes the viewer's own primary agency — so
  // cross-agency / admin-granted members would otherwise show as "Anonymous
  // Member" even though the member list already resolves their names via admin.
  const senderIds = [...new Set((data || []).map((m) => m.user_id).filter(Boolean))];
  const senders = {};
  if (senderIds.length) {
    const { data: profs } = await admin
      .from('profiles')
      .select('id, full_name, email, role')
      .in('id', senderIds);
    (profs || []).forEach((p) => { senders[p.id] = p; });
  }

  const formatted = (data || []).map((msg) => {
    const p = senders[msg.user_id] || msg.profiles || {};
    return {
      id: msg.id,
      message: msg.message,
      channel: msg.channel,
      createdAt: msg.created_at,
      edited: msg.edited || false,
      userId: msg.user_id,
      attachments: Array.isArray(msg.attachments) ? msg.attachments : [],
      userName: p.full_name || p.email || 'Member',
      userEmail: p.email || '',
      userRole: p.role || 'member',
    };
  });

  return ok(formatted);
}

export async function POST(request, { params }) {
  const { id: workspaceId } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return badRequest('Unauthorized');

  const body = await request.json().catch(() => ({}));
  const { message, channel = 'random' } = body;

  // Sanitize attachments to { url, name, type, size } (max 10).
  const attachments = (Array.isArray(body.attachments) ? body.attachments : [])
    .slice(0, 10)
    .map((a) => ({ url: String(a?.url || ''), name: String(a?.name || 'file'), type: String(a?.type || ''), size: Number(a?.size) || 0 }))
    .filter((a) => a.url);

  const text = (message || '').trim();
  if (text === '' && attachments.length === 0) return badRequest('message or attachments required');

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
      message: text,
      channel,
      attachments,
    })
    .select(`
      id,
      message,
      channel,
      created_at,
      edited,
      user_id,
      attachments,
      profiles:user_id (
        full_name,
        email,
        role,
        avatar_url
      )
    `)
    .single();

  if (error) return fromSupabaseError(error);

  // "Daily Tasks" channel: every message becomes a task on the sender's own
  // homepage checklist (member_missions.tasks) — best-effort, never blocks the send.
  if (channel === 'daily_tasks' && text) {
    try {
      const adminTasks = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase;
      const { data: ws } = await adminTasks.from('workspaces').select('agency_id').eq('id', workspaceId).single();
      if (ws?.agency_id) {
        const { data: existing } = await adminTasks
          .from('member_missions').select('*').eq('agency_id', ws.agency_id).eq('user_id', user.id).maybeSingle();
        const nextTasks = [...(Array.isArray(existing?.tasks) ? existing.tasks : []), { text, done: false }];
        await adminTasks.from('member_missions').upsert({
          agency_id: ws.agency_id, user_id: user.id,
          department: existing?.department ?? null, mission: existing?.mission ?? null,
          priorities: existing?.priorities ?? [], outcomes: existing?.outcomes ?? [],
          weekly_objectives: existing?.weekly_objectives ?? [], kpis: existing?.kpis ?? [],
          tasks: nextTasks, updated_at: new Date().toISOString(),
        }, { onConflict: 'agency_id,user_id' });
      }
    } catch (err) { console.error('[chat] daily task bridge failed', err); }
  }

  // Fire push notifications to the recipients (best-effort; never blocks the send).
  try {
    const adminPush = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase;
    const senderName = data.profiles?.full_name || data.profiles?.email || 'Someone';
    const isDm = channel.startsWith('dm:');
    const recipients = await pushRecipients(adminPush, workspaceId, channel, user.id);
    const preview = text || (attachments.length ? '📎 Attachment' : 'New message');
    await sendPushToUsers(recipients, {
      title: isDm ? senderName : `${senderName} · #${GROUP_CHANNEL_NAMES[channel] || channel}`,
      body: preview.length > 120 ? `${preview.slice(0, 117)}…` : preview,
      icon: data.profiles?.avatar_url || undefined,
      tag: channel,
      url: `/os/chat?workspaceId=${workspaceId}&channel=${encodeURIComponent(channel)}`,
    });
  } catch (_) { /* push is best-effort */ }

  return created({
    id: data.id,
    message: data.message,
    channel: data.channel,
    createdAt: data.created_at,
    edited: data.edited || false,
    userId: data.user_id,
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
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
      id, message, channel, created_at, edited, user_id, attachments,
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
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
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
