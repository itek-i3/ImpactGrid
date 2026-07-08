'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search, Bell, Plus, PanelLeft, Star, Share2, Undo2, Redo2,
  LogOut, Settings, User,
} from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { useEditorStore } from '@/lib/store/useEditorStore';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';

export default function Topbar() {
  const router = useRouter();
  const {
    currentPage, sidebarOpen, toggleSidebar,
    updatePage, toggleFavoritePage,
    toggleSearch, workspace, userProfile, theme,
    unreadChatCount, clearAllChatNotifications,
  } = useWorkspaceStore();
  const toast = useToast();
  const { undo, redo, _historyStack, _futureStack } = useEditorStore();

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showPublishMenu, setShowPublishMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profileMenuPos, setProfileMenuPos] = useState({ top: 0, right: 0 });
  const [now, setNow] = useState(() => Date.now());
  const profileBtnRef = useRef(null);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    let unsubscribe;
    import('@/lib/store/useEditorStore').then(({ useEditorStore }) => {
      if (!useEditorStore?.subscribe) return;
      const s = useEditorStore.getState();
      setIsSaving(s.isSaving);
      setLastSaved(s.lastSaved);
      unsubscribe = useEditorStore.subscribe((state) => {
        setIsSaving(state.isSaving);
        setLastSaved(state.lastSaved);
      });
    }).catch(() => {});
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!showPublishMenu) return;
    const h = () => setShowPublishMenu(false);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [showPublishMenu]);

  useEffect(() => {
    if (!showProfileMenu) return;
    const h = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showProfileMenu]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const saveLabel = (() => {
    if (isSaving) return 'Saving…';
    if (!lastSaved) return '';
    const diff = Math.floor((now - new Date(lastSaved)) / 1000);
    if (diff < 5) return 'Saved';
    if (diff < 60) return `Saved ${diff}s ago`;
    return `Saved ${Math.floor(diff / 60)}m ago`;
  })();

  const btnStyle = {
    width: 38, height: 38, borderRadius: 11,
    border: '1px solid rgba(48,108,236,0.25)',
    background: 'rgba(255,255,255,0.05)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#7EB3FF', cursor: 'pointer', transition: 'all .15s',
    flexShrink: 0,
  };

  const isReadOnly = userProfile?.role === 'member';
  const isLight = theme === 'light';

  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '20px 48px',
      borderBottom: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(48,108,236,0.18)',
      background: isLight ? 'rgba(255,255,255,0.97)' : 'rgba(2,4,10,0.80)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      flexShrink: 0, position: 'sticky', top: 0, zIndex: 200,
    }}>
      {/* Sidebar toggle — always visible, matching agency dashboard */}
      <button className="ig-kbtn" onClick={toggleSidebar} title="Toggle sidebar">
        <PanelLeft size={17} />
      </button>

      {/* Undo / Redo */}
      {!isReadOnly && (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="ig-kbtn"
            title="Undo (Ctrl+Z)"
            onClick={undo}
            disabled={_historyStack.length === 0}
            style={{ ...btnStyle, width: 32, height: 32, opacity: _historyStack.length === 0 ? 0.35 : 1 }}
          >
            <Undo2 size={15} />
          </button>
          <button
            className="ig-kbtn"
            title="Redo (Ctrl+Y)"
            onClick={redo}
            disabled={_futureStack.length === 0}
            style={{ ...btnStyle, width: 32, height: 32, opacity: _futureStack.length === 0 ? 0.35 : 1 }}
          >
            <Redo2 size={15} />
          </button>
        </div>
      )}

      {/* Page title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {saveLabel && !isReadOnly && (
          <div style={{ fontSize: 11, color: '#3D5A8A', fontWeight: 600, letterSpacing: '.03em', marginBottom: 1 }}>
            {saveLabel}
          </div>
        )}
        <h1 className="display" style={{
          fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-.01em',
          ...(isLight
            ? { color: '#0F1C38' }
            : { background: 'linear-gradient(135deg,#FFFFFF,#7EB3FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
          ),
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {currentPage ? (currentPage.icon ? `${currentPage.icon} ` : '') + (currentPage.title || 'Untitled') : workspace?.name || 'Workspace'}
        </h1>
      </div>

      {/* Search bar */}
      <div className="ig-search" onClick={toggleSearch} style={{ cursor: 'pointer', minWidth: 230 }}>
        <Search size={15} />
        <input
          readOnly
          placeholder="Search pages…"
          onClick={toggleSearch}
          style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit', fontSize: 13, color: isLight ? '#0F1C38' : '#E2EEFF', width: '100%', cursor: 'pointer' }}
        />
        <span style={{ fontSize: 11, color: isLight ? '#7A8EB0' : '#3D5A8A', background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 5, flexShrink: 0 }}>⌘K</span>
      </div>

      {/* Favorite */}
      {currentPage && (
        <button
          className="ig-kbtn"
          title={currentPage.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
          onClick={() => toggleFavoritePage(currentPage.id)}
          style={{ ...btnStyle, color: currentPage.isFavorite ? '#F5A623' : '#7EB3FF' }}
        >
          <Star size={16} fill={currentPage.isFavorite ? '#F5A623' : 'none'} />
        </button>
      )}

      {/* Share / Publish */}
      {currentPage && !isReadOnly && (
        <div style={{ position: 'relative' }}>
          <button
            className="ig-kbtn"
            title="Publish to Web"
            onClick={(e) => { e.stopPropagation(); setShowPublishMenu(!showPublishMenu); }}
            style={{ ...btnStyle, position: 'relative' }}
          >
            <Share2 size={16} />
            {currentPage.isPublished && (
              <span style={{ position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: 99, background: '#16A36B', border: '2px solid #02040A' }} />
            )}
          </button>

          {showPublishMenu && (
            <div onClick={(e) => e.stopPropagation()} style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 8,
              background: 'rgba(13,27,56,0.96)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(48,108,236,0.30)', borderRadius: 14,
              padding: 20, boxShadow: '0 16px 48px rgba(0,0,0,.60)',
              zIndex: 500, width: 300, display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#E2EEFF', fontFamily: 'var(--font-display)' }}>Publish to Web</span>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 700,
                  background: currentPage.isPublished ? 'rgba(22,163,107,0.18)' : 'rgba(255,255,255,0.06)',
                  color: currentPage.isPublished ? '#16A36B' : '#3D5A8A',
                }}>
                  {currentPage.isPublished ? 'Live' : 'Private'}
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#3D5A8A', margin: 0, lineHeight: 1.5 }}>
                {currentPage.isPublished
                  ? 'Anyone with the link can view this page.'
                  : 'Publish to share with members, volunteers, or partners.'}
              </p>
              {currentPage.isPublished && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input readOnly value={`${origin}/public/${currentPage.id}`}
                    style={{ width: '100%', padding: '7px 10px', background: '#0d1b38', border: '1px solid rgba(48,108,236,0.30)', borderRadius: 8, color: '#7EB3FF', fontSize: 11, outline: 'none' }}
                    onClick={(e) => e.target.select()} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { navigator.clipboard.writeText(`${origin}/os/public/${currentPage.id}`); toast.success('Link Copied', 'Public link copied!'); }}
                      style={{ flex: 1, padding: '7px', background: '#306CEC', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Copy Link
                    </button>
                    <Link href={`/public/${currentPage.id}`} target="_blank" rel="noopener noreferrer"
                      style={{ flex: 1, padding: '7px', background: 'rgba(255,255,255,0.06)', color: '#E2EEFF', border: '1px solid rgba(48,108,236,0.25)', borderRadius: 8, fontSize: 12, fontWeight: 600, textAlign: 'center', textDecoration: 'none' }}>
                      Open
                    </Link>
                  </div>
                </div>
              )}
              <button onClick={() => {
                const next = !currentPage.isPublished;
                updatePage(currentPage.id, { isPublished: next });
                next ? toast.success('Published', 'Page is now live.') : toast.info('Unpublished', 'Page is now private.');
              }} style={{
                width: '100%', padding: '9px',
                background: currentPage.isPublished ? 'rgba(224,72,90,0.15)' : 'linear-gradient(135deg,#1E4FB8,#306CEC)',
                color: currentPage.isPublished ? '#E0485A' : '#fff',
                border: currentPage.isPublished ? '1px solid rgba(224,72,90,0.35)' : 'none',
                borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                {currentPage.isPublished ? 'Unpublish' : 'Publish to Web'}
              </button>
            </div>
          )}
        </div>
      )}


      {/* Bell */}
      <button
        className="ig-kbtn"
        onClick={() => {
          clearAllChatNotifications();
          router.push(`/chat${workspace?.id ? `?workspaceId=${workspace.id}` : ''}`);
        }}
        style={{ ...btnStyle, position: 'relative' }}
        title={unreadChatCount > 0 ? `${unreadChatCount} unread chat notification${unreadChatCount > 1 ? 's' : ''}` : 'Open chat'}
      >
        <Bell size={17} />
        {unreadChatCount > 0 && (
          <span style={{
            position: 'absolute', top: 6, right: 7, minWidth: 16, height: 16,
            padding: '0 4px', borderRadius: 999, background: '#E0485A', border: '2px solid #02040A',
            color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {unreadChatCount > 9 ? '9+' : unreadChatCount}
          </span>
        )}
      </button>

      {/* New page */}
      {!isReadOnly && (
        <button
          onClick={async () => {
            const { addPage } = useWorkspaceStore.getState();
            const newId = await addPage({ title: '', icon: '📄', parentId: null, isDatabase: false });
            if (newId && workspace) router.push(`/${workspace.id}/${newId}`);
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '0 16px', height: 38, borderRadius: 11,
            background: 'linear-gradient(135deg,#1E4FB8,#306CEC)',
            color: '#fff', border: 'none', fontFamily: 'inherit',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(48,108,236,0.40)',
            flexShrink: 0,
          }}
        >
          <Plus size={16} /> New
        </button>
      )}

      {/* Profile */}
      {userProfile && (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            ref={profileBtnRef}
            onClick={() => {
              if (!showProfileMenu && profileBtnRef.current) {
                const rect = profileBtnRef.current.getBoundingClientRect();
                setProfileMenuPos({ top: rect.bottom + 10, right: window.innerWidth - rect.right });
              }
              setShowProfileMenu((v) => !v);
            }}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg,#1E4FB8,#306CEC)',
              border: `2px solid ${showProfileMenu ? '#306CEC' : 'rgba(48,108,236,0.45)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer',
              overflow: 'hidden', boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
              padding: 0, transition: 'border-color .15s',
            }}
          >
            {userProfile.avatar_url ? (
              <img src={userProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              (userProfile.full_name || userProfile.email || '?').charAt(0).toUpperCase()
            )}
          </button>

          {showProfileMenu && (
            <div ref={profileMenuRef} style={{
              position: 'fixed', top: profileMenuPos.top, right: profileMenuPos.right,
              background: 'rgba(8,14,34,0.97)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(48,108,236,0.28)', borderRadius: 14,
              boxShadow: '0 16px 48px rgba(0,0,0,0.7)', width: 240, overflow: 'hidden',
              zIndex: 9999,
            }}>
              {/* Header */}
              <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(48,108,236,0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg,#1E4FB8,#306CEC)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, color: '#fff', overflow: 'hidden',
                  }}>
                    {userProfile.avatar_url
                      ? <img src={userProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (userProfile.full_name || userProfile.email || '?').charAt(0).toUpperCase()
                    }
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#E2EEFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {userProfile.full_name || 'No name set'}
                    </div>
                    <div style={{ fontSize: 11, color: '#3D5A8A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {userProfile.email}
                    </div>
                  </div>
                </div>
                <div style={{
                  marginTop: 10, display: 'inline-flex', alignItems: 'center',
                  padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                  background: 'rgba(48,108,236,0.15)', color: '#7EB3FF',
                  border: '1px solid rgba(48,108,236,0.25)', textTransform: 'capitalize',
                }}>
                  {userProfile.role || 'member'}
                </div>
              </div>

              {/* Menu items */}
              <div style={{ padding: '6px 0' }}>
                {[
                  { icon: <User size={14} />, label: 'My Profile', onClick: () => { router.push('/settings'); setShowProfileMenu(false); } },
                  { icon: <Settings size={14} />, label: 'Settings', onClick: () => { router.push('/customize'); setShowProfileMenu(false); } },
                ].map((item) => (
                  <button key={item.label} type="button" onClick={item.onClick} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 16px', background: 'none', border: 'none',
                    color: '#9DB8DD', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                    transition: '.12s', textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(48,108,236,0.10)'; e.currentTarget.style.color = '#E2EEFF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#9DB8DD'; }}
                  >
                    <span style={{ color: '#4A6FA5' }}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}

                <div style={{ height: 1, background: 'rgba(48,108,236,0.12)', margin: '4px 0' }} />

                <button type="button" onClick={handleSignOut} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 16px', background: 'none', border: 'none',
                  color: '#E0485A', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  transition: '.12s', textAlign: 'left',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(224,72,90,0.10)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
