'use client';

import { create } from 'zustand';

const isDemo = () => {
  try {
    return require('./useWorkspaceStore').useWorkspaceStore.getState().isDemo;
  } catch {
    return true;
  }
};

const api = {
  post:   (url, body)    => fetch(url, { method: 'POST',   headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  patch:  (url, body)    => fetch(url, { method: 'PATCH',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  delete: (url)          => fetch(url, { method: 'DELETE' }),
};

export const useSessionStore = create((set, get) => ({
  session:          null,   // current user's active session
  teamSessions:     [],     // other agency members' sessions
  history:          [],     // completed sessions (local)
  sessionModalOpen: false,

  openSessionModal:  () => set({ sessionModalOpen: true }),
  closeSessionModal: () => set({ sessionModalOpen: false }),

  // ── Fetch team sessions (poll every N seconds) ────────────────────────
  fetchTeamSessions: async (workspaceId) => {
    if (!workspaceId || isDemo()) return;
    try {
      const res = await fetch(`/os/api/sessions?workspaceId=${workspaceId}`);
      if (!res.ok) return;
      const { data } = await res.json();
      const myUserId = get().session?.userId
        || require('./useWorkspaceStore').useWorkspaceStore.getState().userProfile?.id;
      const others = (data || []).filter((s) => s.user_id !== myUserId);
      set({ teamSessions: others });
    } catch {
      // silently ignore polling errors
    }
  },

  // ── Start a new session ───────────────────────────────────────────────
  startSession: async (durationSeconds, taskDescription, workspaceId) => {
    const endTime = Date.now() + durationSeconds * 1000;
    let dbId = null;
    let userId = null;

    if (!isDemo() && workspaceId) {
      try {
        const res = await api.post('/os/api/sessions', {
          workspaceId,
          taskDescription: taskDescription || '',
          durationSeconds,
          endTime,
        });
        if (res.ok) {
          const { data } = await res.json();
          dbId = data?.id ?? null;
          userId = data?.user_id ?? null;
        }
      } catch { /* run locally */ }
    }

    set({
      session: {
        id:              dbId || crypto.randomUUID(),
        dbId,
        workspaceId:     workspaceId || null,
        userId,
        taskDescription: taskDescription || '',
        durationSeconds,
        startedAt:       Date.now(),
        endTime,
        pausedAt:        null,
        status:          'active',
        snoozeCount:     0,
        completionNote:  '',
      },
    });
  },

  // ── Pause ─────────────────────────────────────────────────────────────
  pauseSession: () => {
    const { session } = get();
    if (!session || session.status !== 'active') return;
    const pausedAt = Date.now();
    const next = { ...session, status: 'paused', pausedAt };
    set({ session: next });

    if (session.dbId && !isDemo()) {
      api.patch(`/os/api/sessions/${session.dbId}`, { status: 'paused', paused_at: pausedAt }).catch(() => {});
    }
  },

  // ── Resume ────────────────────────────────────────────────────────────
  resumeSession: () => {
    const { session } = get();
    if (!session || session.status !== 'paused') return;
    const pausedDuration = Date.now() - session.pausedAt;
    const endTime = session.endTime + pausedDuration;
    const next = { ...session, status: 'active', endTime, pausedAt: null };
    set({ session: next });

    if (session.dbId && !isDemo()) {
      api.patch(`/os/api/sessions/${session.dbId}`, { status: 'active', end_time: endTime, paused_at: null }).catch(() => {});
    }
  },

  // ── Expire (timer ran out) ────────────────────────────────────────────
  expireSession: () => {
    const { session } = get();
    if (!session || session.status === 'expired' || session.status === 'logging') return;
    set({ session: { ...session, status: 'expired' } });

    if (session.dbId && !isDemo()) {
      api.patch(`/os/api/sessions/${session.dbId}`, { status: 'expired' }).catch(() => {});
    }
  },

  // ── Snooze ────────────────────────────────────────────────────────────
  snoozeSession: (snoozeSeconds = 300) => {
    const { session } = get();
    if (!session) return;
    const endTime = Date.now() + snoozeSeconds * 1000;
    const next = { ...session, status: 'active', endTime, snoozeCount: session.snoozeCount + 1 };
    set({ session: next });

    if (session.dbId && !isDemo()) {
      api.patch(`/os/api/sessions/${session.dbId}`, {
        status: 'active',
        end_time: endTime,
        snooze_count: next.snoozeCount,
      }).catch(() => {});
    }
  },

  // ── Begin logging (transition to note entry) ──────────────────────────
  beginLogging: () => {
    const { session } = get();
    if (!session) return;
    set({ session: { ...session, status: 'logging' } });

    if (session.dbId && !isDemo()) {
      api.patch(`/os/api/sessions/${session.dbId}`, { status: 'logging' }).catch(() => {});
    }
  },

  // ── Complete ──────────────────────────────────────────────────────────
  completeSession: (note = '') => {
    const { session, history } = get();
    if (!session) return;
    const completedAt = Date.now();
    const completed = { ...session, completionNote: note, status: 'completed', completedAt };
    set({ session: null, history: [completed, ...history].slice(0, 30) });

    if (session.dbId && !isDemo()) {
      api.patch(`/os/api/sessions/${session.dbId}`, {
        status: 'completed',
        completion_note: note,
        completed_at: completedAt,
      }).catch(() => {});
    }
  },

  // ── Cancel (discard without logging) ─────────────────────────────────
  cancelSession: () => {
    const { session } = get();
    if (!session) return;
    set({ session: null });

    if (session.dbId && !isDemo()) {
      api.delete(`/os/api/sessions/${session.dbId}`).catch(() => {});
    }
  },

  // ── Fetch completed session history from Supabase ─────────────────────
  fetchHistory: async (workspaceId) => {
    if (!workspaceId || isDemo()) return;
    try {
      const res = await fetch(`/os/api/sessions?workspaceId=${workspaceId}&history=true`);
      if (!res.ok) return;
      const { data } = await res.json();
      set({ history: data || [] });
    } catch {}
  },

  // ── Clear all completed sessions ──────────────────────────────────────
  clearHistory: async (workspaceId) => {
    set({ history: [] });
    if (!workspaceId || isDemo()) return;
    await fetch(`/os/api/sessions?workspaceId=${workspaceId}`, { method: 'DELETE' }).catch(() => {});
  },
}));
