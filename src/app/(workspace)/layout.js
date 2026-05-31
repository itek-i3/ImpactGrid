'use client';

import { useEffect } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import SearchModal from '@/components/layout/SearchModal';
import { ToastProvider } from '@/components/ui/Toast';
import styles from '@/styles/layout.module.css';

/**
 * Workspace layout — authenticated shell with collapsible sidebar,
 * top bar, and main content area. Wraps all workspace routes.
 */
function WorkspaceShell({ children }) {
  const {
    workspace,
    initDemoWorkspace,
    theme,
    setTheme,
  } = useWorkspaceStore();

  // Initialize workspace on mount (demo mode for now)
  useEffect(() => {
    if (!workspace) {
      initDemoWorkspace();
    }

    // Restore theme preference
    const savedTheme = localStorage.getItem('impactnotion-theme');
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.workspaceShell}>
      <Sidebar />

      <div className={styles.mainContent}>
        <Topbar />

        <div className={styles.pageContent}>
          {children}
        </div>
      </div>

      <SearchModal />
    </div>
  );
}

export default function WorkspaceLayout({ children }) {
  return (
    <ToastProvider>
      <WorkspaceShell>{children}</WorkspaceShell>
    </ToastProvider>
  );
}
