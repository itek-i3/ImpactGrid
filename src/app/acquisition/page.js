'use client';

// The Acquisition evaluator now lives inside the workspace shell (like Home),
// rendered by WorkspaceClient when currentView === 'acquisition'.
// This route only exists so old links/bookmarks still land in the right place.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';

export default function AcquisitionRedirect() {
  const router = useRouter();
  const setCurrentView = useWorkspaceStore((s) => s.setCurrentView);

  useEffect(() => {
    setCurrentView('acquisition');
    router.replace('/');
  }, [router, setCurrentView]);

  return null;
}
