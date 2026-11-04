'use client';

import { create } from 'zustand';

const LS_KEY = 'impactgrid-session';
// Remembers the dbId of whatever session was most recently completed or
// discarded, so fetchTeamSessions's auto-join never resurrects it — e.g. if
// the completion PATCH is still in flight (or fails outright) when the next
// 20s poll runs, it would otherwise see the row still "active" server-side
// and silently re-adopt it, making an ended session look like it won't stop.
const LS_ENDED_KEY = 'impactgrid-session-ended-id';

function markSessionEnded(id) {
  if (!id || typeof window === 'undefined') return;
  try { localStorage.setItem(LS_ENDED_KEY, id); } catch {}
}

function wasExplicitlyEnded(id) {
  if (!id || typeof window === 'undefined') return false;
  try { return localStorage.getItem(LS_ENDED_KEY) === id; } catch { return false; }
}

function loadInitialSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved?.status || saved.status === 'completed') return null;
    if (saved.status === 'active' && saved.endTime <= Date.now()) return { ...saved, status: 'expired' };
    return saved;
  } catch { return null; }
}

function saveSession(session) {
  if (typeof window === 'undefined') return;
  if (session) {
    window.__igSession = session;
    try { localStorage.setItem(LS_KEY, JSON.stringify(session)); } catch {}
  } else {
    window.__igSession = null;
    try { localStorage.removeItem(LS_KEY); } catch {}
  }
}

const isDemo = () => {
  try {
    return require('./useWorkspaceStore').useWorkspaceStore.getState().isDemo;
  } catch {
    return true;
  }
};

const api = {
  post:   (url, body) => fetch(url, { method: 'POST',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  patch:  (url, body) => fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  delete: (url)       => fetch(url, { method: 'DELETE' }),
};

// ── Service worker helpers ────────────────────────────────────────────────────

async function swSend(msg) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage(msg);
  } catch {}
}

async function registerSW() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    // Must match the app's "/os" basePath (see SessionProvider's own
    // registration + next.config.mjs) — registering at the bare root 404s.
    await navigator.serviceWorker.register('/os/session-sw.js', { scope: '/os' });
  } catch {}
}

async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useSessionStore = create((set, get) => ({
  session:          null, // always null on server; restored from localStorage after hydration
  teamSessions:     [],
  history:          [],
  sessionModalOpen: false,

  openSessionModal:  () => set({ sessionModalOpen: true }),
  closeSessionModal: () => set({ sessionModalOpen: false }),

  // ── Re-arm SW notification on page load if session is still active ──
  rearmSW: () => {
    const { session } = get();
    if (!session || session.status !== 'active') return;
    if (session.endTime <= Date.now()) {
      const expired = { ...session, status: 'expired' };
      set({ session: expired });
      saveSession(expired);
      return;
    }
    registerSW().then(() =>
      swSend({ type: 'SESSION_START', endTime: session.endTime, task: session.taskDescription })
    );
  },

  // ── Fetch team sessions ─────────────────────────────────────────────
  fetchTeamSessions: async (workspaceId) => {
    if (!workspaceId || isDemo()) return;
    const myUserId = get().session?.userId
      || require('./useWorkspaceStore').useWorkspaceStore.getState().userProfile?.id;
    // Profile hasn't loaded yet — we can't reliably exclude our own session,
    // so skip this round rather than risk showing ourselves as a "teammate".
    // The next poll (SessionProvider runs one every 20s) will have it.
    if (!myUserId) return;
    try {
      const res = await fetch(`/os/api/sessions?workspaceId=${workspaceId}`);
      if (!res.ok) return;
      const { data } = await res.json();
      const rows = data || [];
      const mine = rows.find((s) => s.user_id === myUserId);
      set({ teamSessions: rows.filter((s) => s.user_id !== myUserId) });

      // Auto-join a group session someone else started and added me to — I
      // have a row on the server but nothing local yet, so adopt it the same
      // way starting one myself would: my own widget/modal, pause/resume,
      // and end-of-session log prompt all just start working off this row.
      // `invitePending` marks it as not-yet-acknowledged so SessionProvider
      // shows the Accept/Decline prompt; it only gets set on first adoption,
      // never again, so dismissing it (either way) sticks.
      if (mine && !get().session && !wasExplicitlyEnded(mine.id)) {
        const groupMembers = mine.group_id
          ? rows.filter((s) => s.group_id === mine.group_id && s.user_id !== myUserId).map((s) => s.profiles).filter(Boolean)
          : [];
        const adopted = {
          id: mine.id, dbId: mine.id, workspaceId, userId: myUserId,
          taskDescription: mine.task_description || '',
          durationSeconds: mine.duration_seconds,
          startedAt: new Date(mine.started_at).getTime(),
          endTime: new Date(mine.end_time).getTime(),
          pausedAt: mine.paused_at ? new Date(mine.paused_at).getTime() : null,
          status: mine.status, snoozeCount: mine.snooze_count || 0, completionNote: mine.completion_note || '',
          groupId: mine.group_id || null, groupMembers,
          invitePending: groupMembers.length > 0,
        };
        set({ session: adopted });
        saveSession(adopted);
        if (adopted.status === 'active') {
          registerSW().then(() => swSend({ type: 'SESSION_START', endTime: adopted.endTime, task: adopted.taskDescription }));
        }
      }
    } catch {}
  },

  // ── Start ───────────────────────────────────────────────────────────
  // `participants` (optional) turns this into a group session — an array of
  // teammate profile objects ({id, full_name, email, avatar_url}) picked in
  // the UI. Each gets their own session row sharing one group_id; their own
  // client auto-adopts it via fetchTeamSessions above.
  startSession: async (durationSeconds, taskDescription, workspaceId, participants = []) => {
    const endTime = Date.now() + durationSeconds * 1000;
    let dbId = null;
    let userId = null;
    let groupId = null;
    const participantIds = participants.map((p) => p.id).filter(Boolean);

    await requestNotificationPermission();
    await registerSW();

    if (!isDemo() && workspaceId) {
      try {
        const res = await api.post('/os/api/sessions', { workspaceId, taskDescription: taskDescription || '', durationSeconds, endTime, participantIds });
        if (res.ok) {
          const { data } = await res.json();
          dbId = data?.id ?? null;
          userId = data?.user_id ?? null;
          groupId = data?.group_id ?? null;
        }
      } catch {}
    }

    const session = {
      id: dbId || crypto.randomUUID(),
      dbId, workspaceId: workspaceId || null, userId,
      taskDescription: taskDescription || '',
      durationSeconds, startedAt: Date.now(), endTime,
      pausedAt: null, status: 'active', snoozeCount: 0, completionNote: '',
      groupId, groupMembers: participants,
    };
    set({ session });
    saveSession(session);
    swSend({ type: 'SESSION_START', endTime, task: taskDescription || '' });
  },

  // ── Invite more people into an already-running session ──────────────
  // `participants` is the same shape startSession takes. Turns a solo
  // session into a group one retroactively if it wasn't already.
  inviteToSession: async (participants = []) => {
    const { session } = get();
    const participantIds = participants.map((p) => p.id).filter(Boolean);
    if (!session?.dbId || isDemo() || !participantIds.length) return;
    try {
      const res = await api.post(`/os/api/sessions/${session.dbId}/invite`, { participantIds });
      if (!res.ok) return;
      const { data } = await res.json();
      const existing = get().session;
      if (!existing || existing.dbId !== session.dbId) return; // session changed under us (ended etc.) — drop the stale update
      const next = {
        ...existing,
        groupId: data?.groupId || existing.groupId,
        groupMembers: [...(existing.groupMembers || []), ...participants],
      };
      set({ session: next });
      saveSession(next);
    } catch {}
  },

  // ── Pause ───────────────────────────────────────────────────────────
  pauseSession: () => {
    const { session } = get();
    if (!session || session.status !== 'active') return;
    const pausedAt = Date.now();
    const next = { ...session, status: 'paused', pausedAt };
    set({ session: next });
    saveSession(next);
    swSend({ type: 'SESSION_CANCEL' });
    if (session.dbId && !isDemo()) api.patch(`/os/api/sessions/${session.dbId}`, { status: 'paused', paused_at: pausedAt }).catch(() => {});
  },

  // ── Resume ──────────────────────────────────────────────────────────
  resumeSession: () => {
    const { session } = get();
    if (!session || session.status !== 'paused') return;
    const endTime = session.endTime + (Date.now() - session.pausedAt);
    const next = { ...session, status: 'active', endTime, pausedAt: null };
    set({ session: next });
    saveSession(next);
    swSend({ type: 'SESSION_START', endTime, task: session.taskDescription });
    if (session.dbId && !isDemo()) api.patch(`/os/api/sessions/${session.dbId}`, { status: 'active', end_time: endTime, paused_at: null }).catch(() => {});
  },

  // ── Expire ──────────────────────────────────────────────────────────
  expireSession: () => {
    const { session } = get();
    if (!session || session.status === 'expired' || session.status === 'logging') return;
    const next = { ...session, status: 'expired' };
    set({ session: next });
    saveSession(next);
    if (session.dbId && !isDemo()) api.patch(`/os/api/sessions/${session.dbId}`, { status: 'expired' }).catch(() => {});
  },

  // ── Snooze ──────────────────────────────────────────────────────────
  snoozeSession: (snoozeSeconds = 300) => {
    const { session } = get();
    if (!session) return;
    const endTime = Date.now() + snoozeSeconds * 1000;
    const next = { ...session, status: 'active', endTime, snoozeCount: session.snoozeCount + 1 };
    set({ session: next });
    saveSession(next);
    swSend({ type: 'SESSION_START', endTime, task: session.taskDescription });
    if (session.dbId && !isDemo()) api.patch(`/os/api/sessions/${session.dbId}`, { status: 'active', end_time: endTime, snooze_count: next.snoozeCount }).catch(() => {});
  },

  // ── Begin logging ────────────────────────────────────────────────────
  beginLogging: () => {
    const { session } = get();
    if (!session) return;
    const next = { ...session, status: 'logging' };
    set({ session: next });
    saveSession(next);
    if (session.dbId && !isDemo()) api.patch(`/os/api/sessions/${session.dbId}`, { status: 'logging' }).catch(() => {});
  },

  // ── Complete ─────────────────────────────────────────────────────────
  completeSession: (note = '') => {
    const { session, history } = get();
    if (!session) return;
    const completedAt = Date.now();
    // Shaped to match listMySessionHistory's snake_case columns (what the
    // History list renders) — the in-memory session uses camelCase, so a
    // naive spread here renders as a blank "Focus session · 0m" entry until
    // the next server refetch overwrites it.
    const historyEntry = {
      id: session.dbId || session.id,
      task_description: session.taskDescription,
      duration_seconds: session.durationSeconds,
      started_at: new Date(session.startedAt).toISOString(),
      completed_at: new Date(completedAt).toISOString(),
      completion_note: note,
      snooze_count: session.snoozeCount,
    };
    set({ session: null, history: [historyEntry, ...history].slice(0, 30) });
    saveSession(null);
    markSessionEnded(session.dbId);
    swSend({ type: 'SESSION_CANCEL' });
    if (session.dbId && !isDemo()) api.patch(`/os/api/sessions/${session.dbId}`, { status: 'completed', completion_note: note, completed_at: completedAt }).catch(() => {});
  },

  // ── Cancel ───────────────────────────────────────────────────────────
  cancelSession: () => {
    const { session } = get();
    if (!session) return;
    set({ session: null });
    saveSession(null);
    markSessionEnded(session.dbId);
    swSend({ type: 'SESSION_CANCEL' });
    if (session.dbId && !isDemo()) api.delete(`/os/api/sessions/${session.dbId}`).catch(() => {});
  },

  // ── Acknowledge a group-session invite prompt (Accept) ────────────────
  // The session is already running locally the moment it's adopted — this
  // just dismisses the Accept/Decline card. Declining uses cancelSession,
  // which already does the right thing (removes just this person's row).
  acknowledgeInvite: () => {
    const { session } = get();
    if (!session?.invitePending) return;
    const next = { ...session, invitePending: false };
    set({ session: next });
    saveSession(next);
  },

  // ── History ──────────────────────────────────────────────────────────
  fetchHistory: async (workspaceId) => {
    if (!workspaceId || isDemo()) return;
    try {
      const res = await fetch(`/os/api/sessions?workspaceId=${workspaceId}&history=true`);
      if (!res.ok) return;
      const { data } = await res.json();
      set({ history: data || [] });
    } catch {}
  },

  clearHistory: async (workspaceId) => {
    set({ history: [] });
    if (!workspaceId || isDemo()) return;
    await fetch(`/os/api/sessions?workspaceId=${workspaceId}`, { method: 'DELETE' }).catch(() => {});
  },
}));

// Auto-save session to localStorage on every state change
if (typeof window !== 'undefined') {
  useSessionStore.subscribe((state) => {
    saveSession(state.session);
  });
}
