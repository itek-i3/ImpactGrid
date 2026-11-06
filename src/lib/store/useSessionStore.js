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
  pendingRequests:  [], // other people's 'requested' rows against a session I started
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
      const others = rows.filter((s) => s.user_id !== myUserId);

      // A group is "visible" once it has at least one row the team can
      // already see (active/paused/expired/logging). A lone 'requested' row
      // against a still-solo session is never broadcast on its own — same
      // treatment 'invited' rows already get — but once a group IS visible,
      // its full roster, pending joiners included, is visible too.
      const visibleGroupIds = new Set(
        others
          .filter((s) => s.status === 'active' || s.status === 'paused' || s.status === 'expired' || s.status === 'logging')
          .map((s) => s.group_id)
          .filter(Boolean)
      );
      // My own group (if I'm in one) is already shown in full, correctly
      // rostered, under "Your Session" — listing it again here would both
      // duplicate it and undercount it, since MY OWN row is already missing
      // from `others` by this point, making an N-person group look like N-1.
      const myGroupId = get().session?.groupId || null;
      const teamSessions = others.filter((s) =>
        s.status !== 'invited' &&
        (s.status !== 'requested' || visibleGroupIds.has(s.group_id)) &&
        (!myGroupId || s.group_id !== myGroupId)
      );
      // Requests pending on a session *I* started — mine to approve/decline.
      const pendingRequests = others.filter((s) => s.status === 'requested' && s.started_by === myUserId);
      set({ teamSessions, pendingRequests });

      // A 'requested' row is the one status this client never drives itself
      // — only the starter acting elsewhere moves it on — so this poll is
      // the only thing that will ever notice it got approved or declined.
      const localSession = get().session;
      if (localSession?.status === 'requested' && localSession.dbId) {
        if (!mine || mine.id !== localSession.dbId) {
          // Declined — the row was deleted server-side.
          if (!wasExplicitlyEnded(localSession.dbId)) {
            markSessionEnded(localSession.dbId);
            set({ session: null });
            saveSession(null);
          }
        } else if (mine.status === 'active') {
          // Approved — pick up the group's current state and arm the real
          // session machinery (SW countdown, widget) for the first time.
          const groupMembers = mine.group_id
            ? rows.filter((s) => s.group_id === mine.group_id && s.user_id !== myUserId).map((s) => s.profiles).filter(Boolean)
            : [];
          const next = {
            ...localSession, status: 'active',
            taskDescription: mine.task_description || '',
            durationSeconds: mine.duration_seconds,
            endTime: new Date(mine.end_time).getTime(),
            groupId: mine.group_id || null, groupMembers,
          };
          set({ session: next });
          saveSession(next);
          registerSW().then(() => swSend({ type: 'SESSION_START', endTime: next.endTime, task: next.taskDescription }));
        } else if (!localSession.groupMembers?.[0]) {
          // Still pending — fill in the starter's name once their row is
          // visible in this same snapshot (guaranteed, since you can only
          // request to join an already active/paused session).
          const starterProfile = rows.find((r) => r.user_id === mine.started_by)?.profiles;
          if (starterProfile) {
            const next = { ...localSession, groupMembers: [starterProfile] };
            set({ session: next });
            saveSession(next);
          }
        }
      } else if (localSession?.dbId && !mine) {
        // Self-heal: I have a local active/paused/expired/logging session,
        // but the server no longer has ANY row for me — it was deleted or
        // completed elsewhere. Without this, a vanished row leaves a phantom
        // countdown running forever: nothing else ever clears it, and the
        // next unrelated poll (teamSessions/pendingRequests changing) just
        // re-persists the same stale session to localStorage via the global
        // autosave subscriber below, since that subscriber always saves
        // whatever `session` currently is, not whether it's still valid.
        if (!wasExplicitlyEnded(localSession.dbId)) {
          markSessionEnded(localSession.dbId);
          set({ session: null });
          saveSession(null);
        }
      }

      // Discover a session I have a row in but nothing local yet for — either
      // a group someone started and added me to ('invited', gated on Accept
      // below) or, same mechanism, a session I'm already 'active'/'paused' in
      // that this device just hasn't picked up yet. Adopting an 'invited' row
      // does NOT join it — status stays 'invited' until acceptInvite runs, so
      // the widget/SW/countdown machinery (gated on status === 'active'
      // below) stays off until they actually accept.
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

  // ── Accept a group-session invite ──────────────────────────────────────
  // This is the real join: the row only flips from 'invited' to 'active'
  // here, so nothing about this person counts as "in the session" — not the
  // widget, not Team Sessions, not the countdown — until they actually
  // accept. Declining uses cancelSession, which removes just this row.
  acceptInvite: async () => {
    const { session } = get();
    if (!session || session.status !== 'invited' || !session.dbId) return;
    const next = { ...session, status: 'active' };
    set({ session: next });
    saveSession(next);
    registerSW().then(() => swSend({ type: 'SESSION_START', endTime: next.endTime, task: next.taskDescription }));
    if (!isDemo()) {
      try { await api.patch(`/os/api/sessions/${session.dbId}`, { status: 'active' }); } catch {}
    }
  },

  // ── Request to join a session I can see but wasn't invited to ──────────
  // Mirrors startSession but lands in 'requested' instead of 'active' — only
  // the session's starter approving (respondToJoinRequest, below) actually
  // joins me in. `targetSessionId` is any row belonging to the session/group
  // I want to join — its own solo id, or any member's row id if it's
  // already a group.
  requestToJoinSession: async (targetSessionId) => {
    if (!targetSessionId || isDemo() || get().session) return;
    try {
      const res = await api.post(`/os/api/sessions/${targetSessionId}/join-request`, {});
      if (!res.ok) return;
      const { data } = await res.json();
      const session = {
        id: data.id, dbId: data.id, workspaceId: data.workspace_id, userId: data.user_id,
        taskDescription: data.task_description || '',
        durationSeconds: data.duration_seconds,
        startedAt: new Date(data.started_at).getTime(),
        endTime: new Date(data.end_time).getTime(),
        pausedAt: null, status: 'requested', snoozeCount: 0, completionNote: '',
        groupId: data.group_id || null, groupMembers: [],
      };
      set({ session });
      saveSession(session);
    } catch {}
  },

  // ── Approve/decline a join request on a session I started ──────────────
  // `request` is the full pendingRequests row (not just its id) so that, on
  // approval, we can tell whether it targeted MY OWN currently-active
  // session and merge the new member into local `groupMembers` immediately
  // — the same optimistic pattern inviteToSession already uses — instead of
  // leaving "With ..." stale forever (nothing else ever refreshes an
  // already-active local session's groupMembers). Withdrawing MY OWN
  // pending request is a different action — reuse cancelSession (DELETE),
  // same as declining an invite.
  respondToJoinRequest: async (request, accept, workspaceId) => {
    if (!request?.id || isDemo()) return;
    set({ pendingRequests: get().pendingRequests.filter((r) => r.id !== request.id) });
    try {
      const res = await api.patch(`/os/api/sessions/${request.id}/join-request`, { accept });
      if (res.ok && accept) {
        const { data } = await res.json();
        const existing = get().session;
        if (existing && request.request_target_id === existing.dbId) {
          const next = {
            ...existing,
            groupId: data?.group_id || existing.groupId,
            groupMembers: [...(existing.groupMembers || []), request.profiles].filter(Boolean),
          };
          set({ session: next });
          saveSession(next);
        }
      }
    } catch {}
    if (workspaceId) get().fetchTeamSessions(workspaceId);
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
