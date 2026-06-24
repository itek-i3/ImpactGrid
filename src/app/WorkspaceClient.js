'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { useEditorStore } from '@/lib/store/useEditorStore';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import SearchModal from '@/components/layout/SearchModal';
import FloatingChat from '@/components/layout/FloatingChat';
import BlockEditor from '@/components/editor/BlockEditor';
import { ToastProvider } from '@/components/ui/Toast';
import styles from '@/styles/layout.module.css';

function WorkspaceContent() {
  const searchParams = useSearchParams();
  const targetWorkspaceId = searchParams.get('workspaceId');

  const {
    workspace,
    currentPage,
    setCurrentPage,
    updatePage,
    initDemoWorkspace,
    theme,
    setTheme,
    fetchUserProfile,
    loadWorkspace,
    userProfile,
  } = useWorkspaceStore();

  const { initBlocks, addBlock, blocks } = useEditorStore();

  const titleRef = useRef(null);
  const [showIconPicker, setShowIconPicker] = useState(false);

  useEffect(() => {
    async function init() {
      const profile = await fetchUserProfile();
      if (profile) {
        await loadWorkspace(targetWorkspaceId || undefined);
      } else {
        const { pages } = initDemoWorkspace();
        if (pages.length > 0) {
          setCurrentPage(pages[0]);
        }
      }
    }
    init();

    const savedTheme = localStorage.getItem('impactnotion-theme');
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, [targetWorkspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentPage) {
      initBlocks(currentPage.id);
    }
  }, [currentPage?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showIconPicker) return;
    function handleClick() {
      setShowIconPicker(false);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showIconPicker]);

  const handleTitleChange = useCallback(
    (e) => {
      if (currentPage) {
        updatePage(currentPage.id, { title: e.target.value });
      }
    },
    [currentPage, updatePage]
  );

  const handleTitleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (blocks.length === 0) {
          addBlock({ type: 'paragraph', content: { text: '' } });
        }
        const firstBlock = document.querySelector('[contenteditable]');
        if (firstBlock) firstBlock.focus();
      }
    },
    [blocks, addBlock]
  );

  const commonEmojis = [
    '📄', '📝', '📊', '📋', '📁', '📂', '🗂️', '📌',
    '⭐', '🎯', '🚀', '💡', '🔥', '✅', '📈', '🎨',
    '🏠', '👥', '💰', '📅', '🔗', '💬', '📱', '🌍',
    '🎓', '🏆', '❤️', '🔧', '📦', '🎤', '🎵', '📸',
  ];

  const isReadOnly = userProfile?.role === 'member';

  return (
    <div className={styles.workspaceShell} style={{ background: 'linear-gradient(135deg,#000000 0%,#010408 50%,#000000 100%)' }}>
      <Sidebar />

      <div className={styles.mainContent} style={{ position: 'relative', background: '#000' }}>
        {/* Blue ambient glow — top right */}
        <div style={{
          position: 'absolute', width: 700, height: 700, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(48,108,236,0.18) 0%, transparent 60%)',
          top: -250, right: -150, pointerEvents: 'none', zIndex: 0,
        }} />
        {/* Blue ambient glow — bottom left */}
        <div style={{
          position: 'absolute', width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(30,79,184,0.12) 0%, transparent 65%)',
          bottom: -100, left: -100, pointerEvents: 'none', zIndex: 0,
        }} />

        <Topbar />

        <div className={styles.pageContent} style={{
          position: 'relative', zIndex: 1,
          backgroundImage: `
            linear-gradient(rgba(48,108,236,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(48,108,236,0.06) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}>
          {currentPage ? (
            <div className={styles.pageContainer}>
              <div className={styles.pageHeader}>
                <div className={styles.pageIconWrapper}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <span
                      className={styles.pageIcon}
                      onClick={(e) => {
                        if (isReadOnly) return;
                        e.stopPropagation();
                        setShowIconPicker(!showIconPicker);
                      }}
                      role="button"
                      tabIndex={0}
                      style={{ cursor: isReadOnly ? 'default' : 'pointer' }}
                    >
                      {currentPage.icon || '📄'}
                    </span>

                    {showIconPicker && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: '8px',
                          background: 'var(--color-bg-elevated)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-lg)',
                          padding: 'var(--space-3)',
                          boxShadow: 'var(--shadow-lg)',
                          zIndex: 'var(--z-popover)',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(8, 1fr)',
                          gap: 'var(--space-1)',
                          width: '280px',
                          animation: 'fadeInDown 0.15s ease forwards',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {commonEmojis.map((emoji) => (
                          <button
                            key={emoji}
                            style={{
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 'var(--radius-md)',
                              cursor: 'pointer',
                              fontSize: '1.125rem',
                              transition: 'background var(--transition-fast)',
                              background: 'none',
                              border: 'none',
                            }}
                            onMouseEnter={(e) =>
                              (e.target.style.background = 'var(--color-bg-hover)')
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.background = 'none')
                            }
                            onClick={() => {
                              updatePage(currentPage.id, { icon: emoji });
                              setShowIconPicker(false);
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <input
                  ref={titleRef}
                  className={styles.pageTitleInput}
                  value={currentPage.title || ''}
                  onChange={handleTitleChange}
                  onKeyDown={handleTitleKeyDown}
                  placeholder="Untitled"
                  readOnly={isReadOnly}
                />
              </div>

              <BlockEditor pageId={currentPage.id} readOnly={isReadOnly} />
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                minHeight: 'calc(100dvh - var(--topbar-height))',
                gap: 'var(--space-4)',
                color: 'var(--color-text-muted)',
              }}
            >
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--color-accent-primary-subtle)',
                  borderRadius: 'var(--radius-2xl)',
                  fontSize: '2.5rem',
                  marginBottom: 'var(--space-2)',
                }}
              >
                📄
              </div>
              <h2
                style={{
                  fontSize: 'var(--text-xl)',
                  fontWeight: 'var(--font-semibold)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Select a page to get started
              </h2>
              <p
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-tertiary)',
                  maxWidth: '400px',
                  textAlign: 'center',
                }}
              >
                Choose a page from the sidebar, or create a new one to start
                writing.
              </p>
            </div>
          )}
        </div>
      </div>

      <SearchModal />
      <FloatingChat />
    </div>
  );
}

export default function WorkspaceClient() {
  return (
    <ToastProvider>
      <WorkspaceContent />
    </ToastProvider>
  );
}
