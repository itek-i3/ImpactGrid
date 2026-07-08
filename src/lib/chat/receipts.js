import { createClient } from '@/lib/supabase/client';

// Advance the caller's receipt row for a DM channel.
//   read: true  → bump last_read_at AND last_delivered_at (they viewed it)
//   read: false → bump last_delivered_at only (their app received it)
// The delivered-only path never touches last_read_at, so an incoming "delivered"
// ack can never regress an existing "read". Callers derive tick state (sent /
// delivered / read) by comparing the OTHER participant's timestamps against each
// message's created_at.
export async function writeReceipt(channel, userId, { read }) {
  if (!channel?.startsWith('dm:') || !userId) return;
  const now = new Date().toISOString();
  const payload = read
    ? { channel, user_id: userId, last_read_at: now, last_delivered_at: now, updated_at: now }
    : { channel, user_id: userId, last_delivered_at: now, updated_at: now };
  await createClient()
    .from('chat_reads')
    .upsert(payload, { onConflict: 'channel,user_id' })
    .then(() => {}, () => {}); // best-effort; never throw into UI flows
}
