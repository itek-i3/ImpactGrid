'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import logoImg from '../../../public/logo3.png';
import {
  Plus,
  SquarePen,
  NotepadText,
  ShieldCheck,
  MessageSquare,
  ChevronRight,
  Building2,
  Check,
  Trash2,
  RotateCcw,
  Search,
  X,
  Timer,
  Home,
  Target,
} from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { useSessionStore } from '@/lib/store/useSessionStore';
import PageTree from './PageTree';
import Modal from '@/components/ui/Modal';
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
    currentView,
    setCurrentPage,
    setCurrentView,
    sidebarOpen,
    toggleSidebar,
    addPage,
    restorePage,
    permanentlyDeletePage,
    emptyTrash,
    userProfile,
    agencies,
    activeAgencyId,
    switchAgency,
  } = useWorkspaceStore();

  const { session: activeSession, teamSessions, sessionModalOpen, openSessionModal, closeSessionModal } = useSessionStore();
  const liveTeamCount = teamSessions.filter((s) => s.status === 'active' || s.status === 'paused').length;

  const [agencySwitcherOpen, setAgencySwitcherOpen] = useState(false);
  const agencyPickerRef = useRef(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashSearch, setTrashSearch] = useState('');
  const [copyModal, setCopyModal] = useState({ open: false, page: null });
  const [allWorkspaces, setAllWorkspaces] = useState([]);
  const [selectedWorkspaces, setSelectedWorkspaces] = useState([]);
  const [copying, setCopying] = useState(false);
  const [copyResult, setCopyResult] = useState(null);

  // Close agency switcher on outside click — use mousedown but only if outside the picker
  useEffect(() => {
    if (!agencySwitcherOpen) return;
    const handler = (e) => {
      if (agencyPickerRef.current && !agencyPickerRef.current.contains(e.target)) {
        setAgencySwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [agencySwitcherOpen]);

  // Fetch target workspaces when copy modal opens
  useEffect(() => {
    if (!copyModal.open) return;
    setSelectedWorkspaces([]);
    setCopyResult(null);
    setAllWorkspaces([]);

    async function loadTargets() {
      // Try admin agencies endpoint first (works for superadmins, gives cross-agency list)
      try {
        const res = await fetch('/os/api/admin/agencies');
        if (res.ok) {
          const { data } = await res.json();
          const targets = (data || [])
            .filter((a) => a.workspaceId && a.workspaceId !== workspace?.id)
            .map((a) => ({ id: a.workspaceId, name: a.name, icon: '🏢' }));
          if (targets.length > 0) {
            setAllWorkspaces(targets);
            return;
          }
        }
      } catch (_) {}

      // Fallback: same-agency workspaces (for managers)
      try {
        const res = await fetch('/os/api/workspaces');
        if (res.ok) {
          const { data } = await res.json();
          setAllWorkspaces((data || []).filter((w) => w.id !== workspace?.id));
        }
      } catch (_) {}
    }

    loadTargets();
  }, [copyModal.open, workspace?.id]);

  const handleCopyToWorkspaces = useCallback(async () => {
    if (!copyModal.page || selectedWorkspaces.length === 0) return;
    setCopying(true);
    setCopyResult(null);
    const results = await Promise.allSettled(
      selectedWorkspaces.map((wid) =>
        fetch(`/os/api/workspaces/${wid}/copy-page`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId: copyModal.page.id }),
        })
      )
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    setCopyResult(failed === 0 ? 'success' : `${failed} failed`);
    setCopying(false);
  }, [copyModal.page, selectedWorkspaces]);

  const favoritePages = pages.filter((p) => p.isFavorite && !p.isArchived);
  const archivedPages = pages.filter((p) => p.isArchived);

  const handleOpenPage = useCallback((page) => {
    setCurrentPage(page);
    if (pathname !== '/') router.push('/');
  }, [setCurrentPage, pathname, router]);

  const handleNewPage = useCallback(async () => {
    const newId = await addPage({ title: '', icon: '📄', parentId: null, isDatabase: false });
    if (newId) {
      const freshPage = useWorkspaceStore.getState().pages.find((p) => p.id === newId);
      if (freshPage) setCurrentPage(freshPage);
      if (pathname !== '/') router.push('/');
    }
  }, [addPage, setCurrentPage, pathname, router]);

  const handleSettingsClick = () => {
    router.push('/settings');
  };

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
          padding: '23px 14px',
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
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, overflow: 'hidden',
                background: workspace?.logoUrl ? 'transparent' : undefined,
              }}>
                {workspace?.logoUrl ? (
                  <img src={workspace.logoUrl} alt="Logo" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 8 }} />
                ) : (
                  <Image src={logoImg} width={32} height={32} alt="Logo" style={{ objectFit: 'contain' }} />
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="display" style={{
                  color: '#fff', fontWeight: 700, fontSize: 15,
                  letterSpacing: '-.01em', lineHeight: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {(workspace?.name || '').replace(/\s*workspace\s*$/i, '') || 'My Space'}
                </div>
              </div>
            </>
          )}
        </div>

        {sidebarOpen && (
          <>
            {/* ── Quick Actions ── */}
            <nav style={{ padding: '8px 8px 2px', display: 'flex', flexDirection: 'column', gap: 1 }}>
              {/* Home — always first */}
              <button
                className="ig-nav"
                onClick={() => { setCurrentPage(null); if (pathname !== '/') router.push('/'); }}
                style={!currentPage && !currentView ? { background: 'rgba(48,108,236,0.15)', color: '#7EB3FF' } : {}}
              >
                <Home size={15} />
                <span>Home</span>
              </button>

              {userProfile?.role === 'superadmin' && (
                <button
                  className="ig-nav"
                  onClick={() => router.push('/admin')}
                  style={{
                    color: '#5B9BFF', fontWeight: 600,
                    ...(pathname.startsWith('/admin') ? { background: 'rgba(48,108,236,0.15)', color: '#7EB3FF' } : {}),
                  }}
                >
                  <ShieldCheck size={15} />
                  <span>Admin Panel</span>
                </button>
              )}

              <button
                className="ig-nav"
                onClick={() => router.push(`/chat${workspace?.id ? `?workspaceId=${workspace.id}` : ''}`)}
                style={pathname === '/chat' ? { background: 'rgba(48,108,236,0.15)', color: '#7EB3FF' } : {}}
              >
                <MessageSquare size={15} />
                <span>Chat Room</span>
              </button>

              {agencies?.find(a => a.id === activeAgencyId)?.name?.toLowerCase().includes('acr') && (
                <button
                  className="ig-nav"
                  onClick={() => { setCurrentView('acquisition'); if (pathname !== '/') router.push('/'); }}
                  style={currentView === 'acquisition' ? { background: 'rgba(48,108,236,0.15)', color: '#7EB3FF' } : {}}
                >
                  <Target size={15} />
                  <span>Acquisition</span>
                </button>
              )}

              <button
                className="ig-nav"
                onClick={openSessionModal}
              >
                <Timer size={15} />
                <span>Sessions</span>
                {activeSession?.status === 'active' && (
                  <span className="animate-pulse" style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block', flexShrink: 0 }} />
                )}
                {activeSession?.status === 'paused' && (
                  <span style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0 }} />
                )}
                {activeSession?.status === 'expired' && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#f87171', background: 'rgba(239,68,68,0.15)', borderRadius: 99, padding: '1px 6px' }}>!</span>
                )}
                {!activeSession && liveTeamCount > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,0.12)', borderRadius: 99, padding: '1px 6px' }}>
                    {liveTeamCount}
                  </span>
                )}
              </button>

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
              {userProfile?.role !== 'member' && (
                <button className={styles.sidebarSectionAction} onClick={handleNewPage} aria-label="New page">
                  <Plus size={14} />
                </button>
              )}
            </div>

            <div className={styles.pageTree}>
              <PageTree
                onCopyTo={userProfile?.role !== 'member' ? (page) => setCopyModal({ open: true, page }) : null}
              />
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
              {userProfile?.role !== 'member' && (
                <button className="ig-nav" onClick={handleNewPage}>
                  <SquarePen size={15} />
                  <span>New page</span>
                </button>
              )}

              {/* Agency Switcher — only shown when user belongs to multiple agencies */}
              {agencies.length > 1 && (
                <div style={{ position: 'relative' }}>
                  <button
                    className="ig-nav"
                    onClick={() => setAgencySwitcherOpen((v) => !v)}
                    style={{ width: '100%' }}
                  >
                    <Building2 size={15} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                      {agencies.find((a) => a.id === activeAgencyId)?.name || 'Switch Agency'}
                    </span>
                    <ChevronRight size={12} style={{ flexShrink: 0, color: '#3D5A8A', transition: 'transform .2s', transform: agencySwitcherOpen ? 'rotate(90deg)' : 'none' }} />
                  </button>

                  {agencySwitcherOpen && (
                    <div
                      ref={agencyPickerRef}
                      style={{
                        position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0,
                        background: '#020912', border: '1.5px solid rgba(48,108,236,0.40)',
                        borderRadius: 12, padding: 6,
                        boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
                        zIndex: 9000,
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#4a6fa5', textTransform: 'uppercase', letterSpacing: '.08em', padding: '4px 8px 6px' }}>
                        Your Agencies
                      </div>
                      {agencies.map((agency) => {
                        const isActive = agency.id === activeAgencyId;
                        return (
                          <button
                            key={agency.id}
                            onClick={() => { switchAgency(agency.id); setAgencySwitcherOpen(false); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none',
                              background: isActive ? 'rgba(48,108,236,0.20)' : 'none',
                              color: isActive ? '#E2EEFF' : '#C8DEFF',
                              cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: isActive ? 600 : 400,
                              transition: 'background .12s',
                            }}
                            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(48,108,236,0.10)'; }}
                            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'none'; }}
                          >
                            {agency.logo_url ? (
                              <img src={agency.logo_url} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                            ) : (
                              <span style={{ width: 20, height: 20, borderRadius: 4, background: 'rgba(48,108,236,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11 }}>🏢</span>
                            )}
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agency.name}</span>
                            {isActive && <Check size={13} style={{ color: '#306CEC', flexShrink: 0 }} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <button
                className="ig-nav"
                onClick={() => { setTrashSearch(''); setTrashOpen(true); }}
                style={{ position: 'relative' }}
              >
                <Trash2 size={15} />
                <span>Trash</span>
                {archivedPages.length > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    background: 'rgba(239,68,68,0.18)',
                    color: '#f87171',
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 99,
                    padding: '1px 6px',
                    minWidth: 18,
                    textAlign: 'center',
                  }}>
                    {archivedPages.length}
                  </span>
                )}
              </button>

            </div>
          </>
        )}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className={styles.sidebarOverlay} onClick={toggleSidebar} />
      )}

      {/* Copy to workspace Modal */}
      <Modal
        isOpen={copyModal.open}
        onClose={() => setCopyModal({ open: false, page: null })}
        title={`Copy "${copyModal.page?.title || 'Page'}" to…`}
        maxWidth="420px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {allWorkspaces.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              No other workspaces available
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: 280, overflowY: 'auto' }}>
              {allWorkspaces.map((w) => {
                const checked = selectedWorkspaces.includes(w.id);
                return (
                  <label
                    key={w.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      background: checked ? 'rgba(48,108,236,0.12)' : 'var(--color-bg-secondary)',
                      border: `1px solid ${checked ? 'rgba(48,108,236,0.4)' : 'var(--color-border)'}`,
                      cursor: 'pointer', transition: '.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedWorkspaces((prev) =>
                          prev.includes(w.id) ? prev.filter((id) => id !== w.id) : [...prev, w.id]
                        )
                      }
                      style={{ accentColor: '#306CEC', width: 15, height: 15, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 16 }}>{w.icon ?? '🏢'}</span>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                      {w.name}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {copyResult && (
            <div style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              background: copyResult === 'success' ? 'rgba(22,163,74,0.12)' : 'rgba(239,68,68,0.12)',
              color: copyResult === 'success' ? '#4ade80' : '#f87171',
              fontSize: 'var(--text-sm)', textAlign: 'center',
            }}>
              {copyResult === 'success' ? '✓ Copied successfully' : `⚠ ${copyResult}`}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <button
              onClick={() => setCopyModal({ open: false, page: null })}
              style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleCopyToWorkspaces}
              disabled={selectedWorkspaces.length === 0 || copying}
              style={{
                padding: '7px 16px', borderRadius: 'var(--radius-md)', border: 'none',
                background: selectedWorkspaces.length === 0 || copying ? 'rgba(48,108,236,0.4)' : '#306CEC',
                color: '#fff', cursor: selectedWorkspaces.length === 0 || copying ? 'not-allowed' : 'pointer',
                fontSize: 'var(--text-sm)', fontWeight: 600,
              }}
            >
              {copying ? 'Copying…' : `Copy to ${selectedWorkspaces.length || ''} workspace${selectedWorkspaces.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Trash Modal */}
      <Modal isOpen={trashOpen} onClose={() => setTrashOpen(false)} title="Trash" maxWidth="500px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Search bar */}
          {archivedPages.length > 0 && (
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
              <input
                value={trashSearch}
                onChange={(e) => setTrashSearch(e.target.value)}
                placeholder="Search deleted pages…"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '7px 28px 7px 30px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--text-sm)',
                  outline: 'none',
                }}
              />
              {trashSearch && (
                <button onClick={() => setTrashSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2, display: 'flex' }}>
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {/* Page list */}
          <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(() => {
              const filtered = archivedPages.filter((p) =>
                !trashSearch || (p.title || 'Untitled').toLowerCase().includes(trashSearch.toLowerCase())
              );
              if (archivedPages.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    <Trash2 size={28} style={{ margin: '0 auto 10px', opacity: 0.3, display: 'block' }} />
                    Trash is empty
                  </div>
                );
              }
              if (filtered.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    No pages match &ldquo;{trashSearch}&rdquo;
                  </div>
                );
              }
              return filtered.map((page) => (
                <div
                  key={page.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{page.icon || '📄'}</span>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {page.title || 'Untitled'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => restorePage(page.id)}
                      title="Restore page"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', fontSize: 11, background: 'rgba(48,108,236,0.12)', color: '#7EB3FF', border: '1px solid rgba(48,108,236,0.25)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 500 }}
                    >
                      <RotateCcw size={11} />
                      Restore
                    </button>
                    <button
                      onClick={() => permanentlyDeletePage(page.id)}
                      title="Delete permanently"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', fontSize: 11, background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 500 }}
                    >
                      <X size={11} />
                      Delete
                    </button>
                  </div>
                </div>
              ));
            })()}
          </div>

          {/* Empty Trash footer */}
          {archivedPages.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                {archivedPages.length} item{archivedPages.length !== 1 ? 's' : ''} in trash
              </span>
              <button
                onClick={() => { emptyTrash(); }}
                style={{ padding: '5px 12px', fontSize: 11, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600 }}
              >
                Empty Trash
              </button>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
