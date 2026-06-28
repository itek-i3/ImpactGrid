'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, MessageSquare, Settings, ChevronRight } from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { useRouter } from 'next/navigation';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeDashboard() {
  const router = useRouter();
  const {
    userProfile, workspace, pages,
    setCurrentPage, addPage, toggleSearch,
  } = useWorkspaceStore();

  const [note, setNote]     = useState('');
  const [loaded, setLoaded] = useState(false);
  const uid      = userProfile?.id;
  const noteKey  = `ig-${uid || 'guest'}-home-note`;

  useEffect(() => {
    try { setNote(localStorage.getItem(noteKey) || ''); } catch {}
    setLoaded(true);
  }, [noteKey]);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(noteKey, note); } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [note, noteKey, loaded]);

  const visiblePages = pages.filter((p) => !p.isArchived).slice(0, 12);
  const name         = userProfile?.full_name?.split(' ')[0] || userProfile?.email?.split('@')[0] || 'there';
  const wsName       = (workspace?.name || '').replace(/\s*workspace\s*$/i, '') || 'My Space';

  const handleNewPage = async () => {
    const page = await addPage({ title: 'Untitled', icon: '📄' });
    if (page) setCurrentPage(page);
  };

  return (
    <div style={{
      minHeight: 'calc(100dvh - var(--topbar-height, 54px))',
      padding: '48px 48px 80px',
      maxWidth: 960,
      margin: '0 auto',
      position: 'relative',
      zIndex: 1,
    }}>

      {/* ── Welcome header ── */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          fontSize: 13, color: 'var(--color-text-tertiary)',
          fontWeight: 600, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase',
        }}>
          {wsName}
        </div>
        <h1 style={{
          fontSize: 36, fontWeight: 800, color: 'var(--color-text-primary)',
          letterSpacing: '-.02em', lineHeight: 1.15, margin: 0,
        }}>
          {greeting()}, {name} 👋
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-tertiary)', marginTop: 8, marginBottom: 0 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ── Quick actions row ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 40 }}>
        {[
          { icon: <Search size={15}/>, label: 'Search pages', action: toggleSearch },
          { icon: <Plus size={15}/>,   label: 'New page',     action: handleNewPage },
          { icon: <MessageSquare size={15}/>, label: 'Chat', action: () => router.push(`/chat${workspace?.id ? `?workspaceId=${workspace.id}` : ''}`) },
          { icon: <Settings size={15}/>, label: 'Customize',  action: () => router.push('/customize') },
        ].map(({ icon, label, action }) => (
          <button key={label} onClick={action} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 16px', borderRadius: 10,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-elevated)',
            color: 'var(--color-text-link)', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all .15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; e.currentTarget.style.borderColor = 'var(--color-border-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-bg-elevated)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── Main two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>

        {/* Left — Notes area */}
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10,
          }}>
            My Notes
          </div>
          <div style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: 16,
            overflow: 'hidden',
          }}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Write anything — ideas, tasks, reminders…"
              style={{
                width: '100%', minHeight: 320,
                background: 'transparent', border: 'none', outline: 'none',
                padding: '20px 24px', resize: 'vertical',
                fontFamily: 'var(--font-sans, system-ui)',
                fontSize: 14, lineHeight: 1.7,
                color: 'var(--color-text-primary)',
                boxSizing: 'border-box',
              }}
            />
            <div style={{
              borderTop: '1px solid var(--color-border-subtle)',
              padding: '8px 16px',
              fontSize: 11, color: 'var(--color-text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            }}>
              {note.length > 0 ? `${note.split(/\s+/).filter(Boolean).length} words · auto-saved` : 'Start typing…'}
            </div>
          </div>
        </div>

        {/* Right — Pages navigation */}
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10,
          }}>
            Pages
          </div>
          <div style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: 16, overflow: 'hidden',
          }}>
            {visiblePages.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                No pages yet.{' '}
                <span onClick={handleNewPage} style={{ color: 'var(--color-text-link)', cursor: 'pointer', fontWeight: 600 }}>
                  Create one →
                </span>
              </div>
            ) : (
              visiblePages.map((page, i) => (
                <div
                  key={page.id}
                  onClick={() => setCurrentPage(page)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 16px',
                    borderBottom: i < visiblePages.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                    cursor: 'pointer', transition: 'background .12s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: 16, flexShrink: 0, width: 22, textAlign: 'center' }}>
                    {page.icon || (page.isDatabase ? '📊' : '📄')}
                  </span>
                  <span style={{
                    flex: 1, fontSize: 13, color: 'var(--color-text-primary)',
                    fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {page.title || 'Untitled'}
                  </span>
                  <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                    {page.isDatabase ? 'DB' : 'Page'}
                  </span>
                  <ChevronRight size={13} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                </div>
              ))
            )}

            {visiblePages.length > 0 && (
              <div
                onClick={handleNewPage}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 16px', cursor: 'pointer',
                  borderTop: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-text-tertiary)', fontSize: 12, fontWeight: 600,
                  transition: 'color .12s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-link)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
              >
                <Plus size={12}/> New page
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
