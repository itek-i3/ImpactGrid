export function normalizeDmParticipants(userIds) {
  return [...new Set((userIds || []).filter(Boolean))].sort();
}

export function buildDmChannel(agencyId, userIdA, userIdB) {
  const participants = normalizeDmParticipants([userIdA, userIdB]);
  if (!agencyId || participants.length < 2) return null;
  return `dm:${agencyId}:${participants.join(':')}`;
}

export function parseDmChannel(channel) {
  if (!channel || !channel.startsWith('dm:')) {
    return { isDm: false, agencyId: null, participants: [] };
  }

  const parts = channel.split(':');
  if (parts.length >= 4) {
    return {
      isDm: true,
      agencyId: parts[1] || null,
      participants: parts.slice(2),
    };
  }

  if (parts.length === 3) {
    return {
      isDm: true,
      agencyId: null,
      participants: parts.slice(1),
    };
  }

  return { isDm: false, agencyId: null, participants: [] };
}

export function isDmParticipant(channel, userId) {
  if (!channel || !userId || !channel.startsWith('dm:')) return false;
  const { participants } = parseDmChannel(channel);
  return participants.includes(userId);
}

export function canAccessDmChannel({ channel, userId, workspaceAgencyId, userRole }) {
  if (!channel || !channel.startsWith('dm:')) return false;
  if (!userId) return false;
  if (userRole === 'superadmin') return false;

  const { agencyId, participants } = parseDmChannel(channel);
  if (!participants.includes(userId)) return false;
  if (workspaceAgencyId && agencyId && agencyId !== workspaceAgencyId) return false;
  return true;
}
