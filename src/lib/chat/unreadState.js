import { createClient } from '@/lib/supabase/client';

const GROUP_CHANNELS = ['daily_tasks', 'weekly_tasks', 'random'];

// On login/reload, resolve which channels (DMs + group channels) have messages
// the user hasn't read yet, using chat_reads.last_read_at as the watermark —
// so unread badges reflect real state instead of only what arrived this
// session via realtime. weekly_tasks/random/DMs stay scoped to a single
// workspace (a user in multiple agencies shouldn't see another workspace's
// weekly_tasks bleed into this one). daily_tasks is the deliberate exception
// — it's a global, cross-agency feed now, so its "latest message" lookup is
// NOT workspace-scoped. chat_reads itself already has no workspace_id column
// at all, so the read/unread comparison below needs no change either way.
export async function fetchUnreadChannels(userId, workspaceId) {
  if (!userId || !workspaceId) return [];
  const sb = createClient();

  const { data: dmRows } = await sb
    .from('chat_messages')
    .select('channel')
    .eq('workspace_id', workspaceId)
    .ilike('channel', 'dm:%')
    .ilike('channel', `%${userId}%`);
  const dmChannels = [...new Set((dmRows || []).map((r) => r.channel))];
  const workspaceScopedChannels = [...GROUP_CHANNELS.filter((c) => c !== 'daily_tasks'), ...dmChannels];
  const channels = [...GROUP_CHANNELS, ...dmChannels];
  if (!channels.length) return [];

  const [{ data: reads }, { data: scoped }, { data: dailyLatest }] = await Promise.all([
    sb.from('chat_reads').select('channel, last_read_at').eq('user_id', userId).in('channel', channels),
    sb.from('chat_messages').select('id, channel, message, user_id, created_at').eq('workspace_id', workspaceId).in('channel', workspaceScopedChannels).order('created_at', { ascending: false }),
    sb.from('chat_messages').select('id, channel, message, user_id, created_at').eq('channel', 'daily_tasks').order('created_at', { ascending: false }).limit(1),
  ]);

  const latest = [...(scoped || []), ...(dailyLatest || [])];
  const readMap = new Map((reads || []).map((r) => [r.channel, r.last_read_at]));
  const latestByChannel = new Map();
  latest.forEach((m) => { if (!latestByChannel.has(m.channel)) latestByChannel.set(m.channel, m); });

  const unread = [];
  latestByChannel.forEach((m, channel) => {
    if (m.user_id === userId) return; // my own last message isn't "unread"
    const readAt = readMap.get(channel);
    if (readAt && new Date(readAt) >= new Date(m.created_at)) return;
    unread.push({ channel, message: m.message, senderId: m.user_id, messageId: m.id, createdAt: m.created_at });
  });
  return unread;
}
