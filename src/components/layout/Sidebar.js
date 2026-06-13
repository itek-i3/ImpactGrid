'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search,
  Settings,
  Plus,
  Trash2,
  History,
  BookMarked,
  Sun,
  Moon,
  LogOut,
  SquarePen,
  MoreHorizontal,
  NotepadText,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import PageTree from './PageTree';
import Modal from '@/components/ui/Modal';
import Dropdown, { DropdownItem, DropdownDivider, DropdownLabel } from '@/components/ui/Dropdown';
import styles from '@/styles/layout.module.css';

function ImpactLogo({ size = 28 }) {
  const sq = (x, y, fill, k) => (
    <rect key={k} x={x} y={y} width="7" height="7" rx="2" fill={fill} />
  );
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      {sq(0,   0,   '#5B9BFF', 'a')}
      {sq(9.5, 0,   '#ffffff33', 'b')}
      {sq(19,  0,   '#ffffff18', 'c')}
      {sq(0,   9.5, '#ffffff18', 'd')}
      {sq(9.5, 9.5, '#306CEC', 'e')}
      {sq(19,  9.5, '#5B9BFF', 'f')}
      {sq(0,   19,  '#5B9BFF', 'g')}
      {sq(9.5, 19,  '#F5A623', 'h')}
      {sq(19,  19,  '#306CEC', 'i')}
    </svg>
  );
}

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
    const newId = await addPage({ title: '', icon: '📄', parentId: null, isDatabase: false });
    if (newId && pathname && !pathname.startsWith('/demo') && workspace) {
      router.push(`/${workspace.id}/${newId}`);
    }
  }, [addPage, workspace, router, pathname]);

  const handleSettingsClick = () => {
    if (workspace) router.push(`/${workspace.id}/settings`);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isDark = theme === 'dark';

  return (
    <>
      <aside
        className={`${styles.sidebar} ${!sidebarOpen ? styles.sidebarCollapsed : ''}`}
        style={{
          background: 'rgba(0,0,0,0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '4px 0 32px rgba(0,0,0,0.60)',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: '18px 14px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
          borderBottom: '1px solid rgba(48,108,236,0.15)',
        }}>
          {sidebarOpen && (
            <>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'linear-gradient(135deg, #0d1b38, #1E4FB8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, boxShadow: '0 3px 10px rgba(48,108,236,0.40)',
              }}>
                <ImpactLogo size={22} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="display" style={{
                  color: '#fff', fontWeight: 700, fontSize: 12.5,
                  letterSpacing: '-.01em', lineHeight: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {workspace?.name || 'Workspace'}
                </div>
                <div style={{ color: '#3D5A8A', fontSize: 9.5, marginTop: 3, letterSpacing: '.06em', fontWeight: 600, textTransform: 'uppercase' }}>
                  Impact Workspace
                </div>
              </div>
            </>
          )}
        </div>

        {sidebarOpen && (
          <>
            {/* ── Quick Actions ── */}
            <nav style={{ padding: '8px 8px 2px', display: 'flex', flexDirection: 'column', gap: 1 }}>
              <button className="ig-nav" onClick={toggleSearch}>
                <Search size={15} />
                <span>Search</span>
                <span style={{
                  marginLeft: 'auto', fontSize: 10, color: '#3D5A8A',
                  background: 'rgba(255,255,255,0.06)', padding: '2px 6px',
                  borderRadius: 5, fontFamily: 'var(--font-mono)',
                }}>⌘K</span>
              </button>

              <Dropdown
                trigger={
                  <button className="ig-nav">
                    <History size={15} />
                    <span>Recent</span>
                  </button>
                }
                align="left"
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
                  <button className="ig-nav">
                    <BookMarked size={15} />
                    <span>Bookmarks</span>
                  </button>
                }
                align="left"
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
            </nav>

            {/* ── Favorites section (pinned in sidebar) ── */}
            {favoritePages.length > 0 && (
              <>
                <div className={styles.sidebarSectionLabel}>
                  <span className={styles.sidebarSectionTitle}>Favorites</span>
                </div>
                <div className={styles.pageTree} style={{ maxHeight: 160, marginBottom: 4 }}>
                  {favoritePages.map((page) => (
                    <div
                      key={page.id}
                      className={`${styles.pageTreeItem} ${currentPage?.id === page.id ? styles.pageTreeItemActive : ''}`}
                      onClick={() => handleOpenPage(page)}
                    >
                      <span className={styles.pageTreeIcon}>{page.icon || '📄'}</span>
                      <span className={styles.pageTreeTitle}>{page.title || 'Untitled'}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Pages section ── */}
            <div className={styles.sidebarSectionLabel}>
              <span className={styles.sidebarSectionTitle} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <NotepadText size={10} />
                Pages
              </span>
              <button className={styles.sidebarSectionAction} onClick={handleNewPage} aria-label="New page">
                <Plus size={14} />
              </button>
            </div>

            <div className={styles.pageTree}>
              <PageTree />
            </div>

            {/* ── Footer ── */}
            <div style={{
              padding: '8px 8px 12px',
              borderTop: '1px solid rgba(48,108,236,0.15)',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}>
              <button className="ig-nav" onClick={handleNewPage}>
                <SquarePen size={15} />
                <span>New page</span>
              </button>

              {/* Dark mode toggle */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 12px', borderRadius: 8,
                transition: '.15s', cursor: 'default',
              }}>
                {isDark ? <Moon size={15} color="#3D5A8A" /> : <Sun size={15} color="#3D5A8A" />}
                <span style={{ flex: 1, fontSize: 12, color: '#3D5A8A', fontWeight: 500 }}>
                  Dark mode
                </span>
                <button
                  onClick={toggleTheme}
                  style={{
                    width: 30, height: 17, borderRadius: 99, border: 'none', cursor: 'pointer',
                    background: isDark ? '#306CEC' : 'rgba(255,255,255,0.15)',
                    position: 'relative', flexShrink: 0, transition: 'background .2s', padding: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2,
                    left: isDark ? 15 : 2,
                    width: 13, height: 13, borderRadius: 99, background: '#fff',
                    transition: 'left .2s', display: 'block',
                  }} />
                </button>
              </div>

              {/* More: Trash + Settings in a dropdown */}
              <Dropdown
                trigger={
                  <button className="ig-nav">
                    <MoreHorizontal size={15} />
                    <span>More</span>
                  </button>
                }
                align="left"
              >
                <DropdownItem icon={<Trash2 size={14} />} onClick={() => setTrashOpen(true)}>Trash</DropdownItem>
                <DropdownItem icon={<Settings size={14} />} onClick={handleSettingsClick}>Settings</DropdownItem>
              </Dropdown>

              <button className="ig-nav" onClick={handleLogout}>
                <LogOut size={15} />
                <span>Log out</span>
              </button>
            </div>
          </>
        )}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className={styles.sidebarOverlay} onClick={toggleSidebar} />
      )}

      {/* Trash Modal */}
      <Modal isOpen={trashOpen} onClose={() => setTrashOpen(false)} title="Trash" maxWidth="480px">
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
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
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
                    style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--color-bg-active)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => permanentlyDeletePage(page.id)}
                    style={{ padding: '4px 8px', fontSize: '11px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
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
