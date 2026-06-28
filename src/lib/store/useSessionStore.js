'use client';

import { create } from 'zustand';

const LS_KEY = 'impactgrid-session';

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
    await navigator.serviceWorker.register('/session-sw.js', { scope: '/' });
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
    try {
      const res = await fetch(`/os/api/sessions?workspaceId=${workspaceId}`);
      if (!res.ok) return;
      const { data } = await res.json();
      const myUserId = get().session?.userId
        || require('./useWorkspaceStore').useWorkspaceStore.getState().userProfile?.id;
      set({ teamSessions: (data || []).filter((s) => s.user_id !== myUserId) });
    } catch {}
  },

  // ── Start ───────────────────────────────────────────────────────────
  startSession: async (durationSeconds, taskDescription, workspaceId) => {
    const endTime = Date.now() + durationSeconds * 1000;
    let dbId = null;
    let userId = null;

    await requestNotificationPermission();
    await registerSW();

    if (!isDemo() && workspaceId) {
      try {
        const res = await api.post('/os/api/sessions', { workspaceId, taskDescription: taskDescription || '', durationSeconds, endTime });
        if (res.ok) {
          const { data } = await res.json();
          dbId = data?.id ?? null;
          userId = data?.user_id ?? null;
        }
      } catch {}
    }

    const session = {
      id: dbId || crypto.randomUUID(),
      dbId, workspaceId: workspaceId || null, userId,
      taskDescription: taskDescription || '',
      durationSeconds, startedAt: Date.now(), endTime,
      pausedAt: null, status: 'active', snoozeCount: 0, completionNote: '',
    };
    set({ session });
    saveSession(session);
    swSend({ type: 'SESSION_START', endTime, task: taskDescription || '' });
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
    set({ session: null, history: [{ ...session, completionNote: note, status: 'completed', completedAt }, ...history].slice(0, 30) });
    saveSession(null);
    swSend({ type: 'SESSION_CANCEL' });
    if (session.dbId && !isDemo()) api.patch(`/os/api/sessions/${session.dbId}`, { status: 'completed', completion_note: note, completed_at: completedAt }).catch(() => {});
  },

  // ── Cancel ───────────────────────────────────────────────────────────
  cancelSession: () => {
    const { session } = get();
    if (!session) return;
    set({ session: null });
    saveSession(null);
    swSend({ type: 'SESSION_CANCEL' });
    if (session.dbId && !isDemo()) api.delete(`/os/api/sessions/${session.dbId}`).catch(() => {});
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
