'use client';

import { useCallback } from 'react';
import {
  Search,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Clock,
  Star,
  Sun,
  Moon,
} from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import PageTree from './PageTree';
import styles from '@/styles/layout.module.css';

/**
 * Sidebar — collapsible navigation panel with workspace switcher,
 * action buttons, page tree, and footer actions.
 */
export default function Sidebar() {
  const {
    workspace,
    sidebarOpen,
    toggleSidebar,
    toggleSearch,
    theme,
    toggleTheme,
    addPage,
  } = useWorkspaceStore();

  const handleNewPage = useCallback(() => {
    addPage({
      title: '',
      icon: '📄',
      parentId: null,
      isDatabase: false,
    });
  }, [addPage]);

  return (
    <>
      <aside
        className={`${styles.sidebar} ${
          !sidebarOpen ? styles.sidebarCollapsed : ''
        }`}
      >
        {/* Header */}
        <div className={styles.sidebarHeader}>
          {sidebarOpen && (
            <div className={styles.workspaceSwitcher}>
              <div className={styles.workspaceIcon}>
                {workspace?.icon || '🚀'}
              </div>
              <span className={styles.workspaceName}>
                {workspace?.name || 'Workspace'}
              </span>
            </div>
          )}
          <button
            className={styles.sidebarToggle}
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? (
              <ChevronLeft size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>
        </div>

        {sidebarOpen && (
          <>
            {/* Quick Actions */}
            <div className={styles.sidebarActions}>
              <button
                className={styles.sidebarActionBtn}
                onClick={toggleSearch}
              >
                <span className={styles.sidebarActionIcon}>
                  <Search size={16} />
                </span>
                Search
                <span className={styles.sidebarActionKbd}>⌘K</span>
              </button>

              <button
                className={styles.sidebarActionBtn}
                onClick={() => {}}
              >
                <span className={styles.sidebarActionIcon}>
                  <Clock size={16} />
                </span>
                Recent
              </button>

              <button
                className={styles.sidebarActionBtn}
                onClick={() => {}}
              >
                <span className={styles.sidebarActionIcon}>
                  <Star size={16} />
                </span>
                Favorites
              </button>
            </div>

            {/* Page Tree Section */}
            <div className={styles.sidebarSectionLabel}>
              <span className={styles.sidebarSectionTitle}>Pages</span>
              <button
                className={styles.sidebarSectionAction}
                onClick={handleNewPage}
                aria-label="New page"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className={styles.pageTree}>
              <PageTree />
            </div>

            {/* Footer */}
            <div className={styles.sidebarFooter}>
              <button
                className={styles.sidebarFooterBtn}
                onClick={handleNewPage}
              >
                <Plus size={16} />
                New page
              </button>

              <button
                className={styles.sidebarFooterBtn}
                onClick={toggleTheme}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>

              <button className={styles.sidebarFooterBtn} onClick={() => {}}>
                <Trash2 size={16} />
                Trash
              </button>

              <button className={styles.sidebarFooterBtn} onClick={() => {}}>
                <Settings size={16} />
                Settings
              </button>
            </div>
          </>
        )}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className={styles.sidebarOverlay}
          onClick={toggleSidebar}
        />
      )}
    </>
  );
}
