'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
import Modal from '@/components/ui/Modal';
import Dropdown, { DropdownItem, DropdownDivider, DropdownLabel } from '@/components/ui/Dropdown';
import styles from '@/styles/layout.module.css';

/**
 * Sidebar — collapsible navigation panel with workspace switcher,
 * action buttons, page tree, and footer actions.
 */
export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    workspace,
    pages,
    currentPage,
    setCurrentPage,
    sidebarOpen,
    toggleSidebar,
    toggleSearch,
    theme,
    toggleTheme,
    addPage,
    restorePage,
    permanentlyDeletePage,
  } = useWorkspaceStore();

  const [trashOpen, setTrashOpen] = useState(false);

  const favoritePages = pages.filter((p) => p.isFavorite && !p.isArchived);
  const archivedPages = pages.filter((p) => p.isArchived);
  const recentPages = [...pages]
    .filter((p) => !p.isArchived)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 6);

  const handleOpenPage = useCallback((page) => {
    setCurrentPage(page);
    if (pathname && !pathname.startsWith('/demo') && workspace) {
      router.push(`/${workspace.id}/${page.id}`);
    }
  }, [workspace, pathname, router, setCurrentPage]);

  const handleNewPage = useCallback(async () => {
    const newId = await addPage({
      title: '',
      icon: '📄',
      parentId: null,
      isDatabase: false,
    });
    if (newId && pathname && !pathname.startsWith('/demo') && workspace) {
      router.push(`/${workspace.id}/${newId}`);
    }
  }, [addPage, workspace, router, pathname]);

  const handleSettingsClick = () => {
    if (workspace) {
      router.push(`/${workspace.id}/settings`);
    }
  };

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
            <div
              className={styles.workspaceSwitcher}
              onClick={() => {
                if (pathname && !pathname.startsWith('/demo') && workspace) {
                  router.push(`/${workspace.id}`);
                }
              }}
              style={{ cursor: 'pointer' }}
            >
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

              <Dropdown
                trigger={
                  <button className={styles.sidebarActionBtn}>
                    <span className={styles.sidebarActionIcon}>
                      <Clock size={16} />
                    </span>
                    Recent
                  </button>
                }
                align="left"
                className="w-full"
              >
                <DropdownLabel>Recently Updated</DropdownLabel>
                <DropdownDivider />
                {recentPages.length === 0 ? (
                  <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    No recent pages
                  </div>
                ) : (
                  recentPages.map((page) => (
                    <DropdownItem
                      key={page.id}
                      icon={<span>{page.icon || '📄'}</span>}
                      onClick={() => handleOpenPage(page)}
                    >
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '160px', display: 'inline-block' }}>
                        {page.title || 'Untitled'}
                      </span>
                    </DropdownItem>
                  ))
                )}
              </Dropdown>

              <Dropdown
                trigger={
                  <button className={styles.sidebarActionBtn}>
                    <span className={styles.sidebarActionIcon}>
                      <Star size={16} />
                    </span>
                    Favorites
                  </button>
                }
                align="left"
                className="w-full"
              >
                <DropdownLabel>Favorites</DropdownLabel>
                <DropdownDivider />
                {favoritePages.length === 0 ? (
                  <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    No favorites yet
                  </div>
                ) : (
                  favoritePages.map((page) => (
                    <DropdownItem
                      key={page.id}
                      icon={<span>{page.icon || '📄'}</span>}
                      onClick={() => handleOpenPage(page)}
                    >
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '160px', display: 'inline-block' }}>
                        {page.title || 'Untitled'}
                      </span>
                    </DropdownItem>
                  ))
                )}
              </Dropdown>
            </div>

            {/* Favorites Section (Persistent in sidebar if items exist) */}
            {favoritePages.length > 0 && (
              <>
                <div className={styles.sidebarSectionLabel}>
                  <span className={styles.sidebarSectionTitle}>Favorites</span>
                </div>
                <div className={styles.pageTree} style={{ marginBottom: 'var(--space-4)' }}>
                  {favoritePages.map((page) => (
                    <div
                      key={page.id}
                      className={`${styles.pageTreeItem} ${
                        currentPage?.id === page.id ? styles.pageTreeItemActive : ''
                      }`}
                      style={{ paddingLeft: '8px', cursor: 'pointer' }}
                      onClick={() => handleOpenPage(page)}
                    >
                      <span className={styles.pageTreeIcon}>{page.icon || '📄'}</span>
                      <span className={styles.pageTreeTitle}>
                        {page.title || 'Untitled'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

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

              <button className={styles.sidebarFooterBtn} onClick={() => setTrashOpen(true)}>
                <Trash2 size={16} />
                Trash
              </button>

              <button className={styles.sidebarFooterBtn} onClick={handleSettingsClick}>
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

      {/* Trash Modal */}
      <Modal
        isOpen={trashOpen}
        onClose={() => setTrashOpen(false)}
        title="Trash"
        maxWidth="480px"
      >
        <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {archivedPages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              No items in Trash
            </div>
          ) : (
            archivedPages.map((page) => (
              <div
                key={page.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                  <span style={{ fontSize: 'var(--text-lg)' }}>{page.icon || '📄'}</span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {page.title || 'Untitled'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                  <button
                    onClick={() => restorePage(page.id)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      background: 'var(--color-bg-active)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                    }}
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => permanentlyDeletePage(page.id)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </>
  );
}
