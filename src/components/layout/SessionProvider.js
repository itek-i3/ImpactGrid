'use client';

import { useEffect } from 'react';
import SessionWidget from './SessionWidget';
import SessionModal from './SessionModal';
import { useSessionStore } from '@/lib/store/useSessionStore';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { applyAllPrefs } from '@/app/customize/page';

const LS_KEY = 'impactgrid-session';

function restoreFromStorage() {
  const current = useSessionStore.getState().session;
  if (current && current.status !== 'completed') return;

  const win = typeof window !== 'undefined' ? window.__igSession : null;
  if (win?.status && win.status !== 'completed') {
    if (win.status === 'active' && win.endTime <= Date.now()) win.status = 'expired';
    useSessionStore.setState({ session: win });
    return;
  }

  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved?.status || saved.status === 'completed') return;
    if (saved.status === 'active' && saved.endTime <= Date.now()) saved.status = 'expired';
    useSessionStore.setState({ session: saved });
  } catch {}
}

export default function SessionProvider() {
  const { sessionModalOpen, closeSessionModal, rearmSW } = useSessionStore();
  // Watch the user ID — when it becomes known, apply that user's saved preferences
  const userId = useWorkspaceStore((s) => s.userProfile?.id);

  useEffect(() => {
    if (!userId) return;
    applyAllPrefs(userId);
  }, [userId]);

  useEffect(() => {
    restoreFromStorage();
    rearmSW();

    const onVisible = () => {
      if (document.visibilityState === 'visible') restoreFromStorage();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <SessionWidget />
      <SessionModal isOpen={sessionModalOpen} onClose={closeSessionModal} />
    </>
  );
}
