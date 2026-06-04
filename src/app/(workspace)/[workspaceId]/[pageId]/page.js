'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { useEditorStore } from '@/lib/store/useEditorStore';
import BlockEditor from '@/components/editor/BlockEditor';
import DatabaseContainer from '@/components/database/DatabaseContainer';
import AgencyDetailDashboard from '@/components/community/AgencyDetailDashboard';
import styles from '@/styles/layout.module.css';

const COMMON_EMOJIS = [
  '📄', '📝', '📊', '📋', '📁', '📂', '🗂️', '📌',
  '⭐', '🎯', '🚀', '💡', '🔥', '✅', '📈', '🎨',
  '🏠', '👥', '💰', '📅', '🔗', '💬', '📱', '🌍',
  '🎓', '🏆', '❤️', '🔧', '📦', '🎤', '🎵', '📸',
];

/**
 * Document/Database page — renders the block editor or database
 * container based on the page type.
 */
export default function PageView({ params }) {
  const unwrappedParams = React.use(params);
  const { pageId } = unwrappedParams;

  const {
    pages,
    currentPage,
    setCurrentPage,
    updatePage,
  } = useWorkspaceStore();

  const { initBlocks, addBlock, blocks } = useEditorStore();

  const titleRef = useRef(null);
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Set current page based on the pageId param
  useEffect(() => {
    if (pageId) {
      const page = pages.find((p) => p.id === pageId);
      if (page && page.id !== currentPage?.id) {
        setCurrentPage(page);
      }
    }
  }, [pageId, pages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize blocks when page changes
  useEffect(() => {
    if (currentPage && !currentPage.isDatabase) {
      initBlocks(currentPage.id);
    }
  }, [currentPage?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close icon picker on click outside
  useEffect(() => {
    if (!showIconPicker) return;
    function handleClick() {
      setShowIconPicker(false);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showIconPicker]);

  // Handle title change
  const handleTitleChange = useCallback(
    (e) => {
      if (currentPage) {
        updatePage(currentPage.id, { title: e.target.value });
      }
    },
    [currentPage, updatePage]
  );

  // Handle title keydown — Enter moves to first block
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

  if (!currentPage) {
    return (
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
          Page not found
        </h2>
        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          Select a page from the sidebar to get started.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        {/* Icon Picker */}
        <div className={styles.pageIconWrapper}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <span
              className={styles.pageIcon}
              onClick={(e) => {
                e.stopPropagation();
                setShowIconPicker(!showIconPicker);
              }}
              role="button"
              tabIndex={0}
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
                {COMMON_EMOJIS.map((emoji) => (
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

        {/* Title */}
        <input
          ref={titleRef}
          className={styles.pageTitleInput}
          value={currentPage.title || ''}
          onChange={handleTitleChange}
          onKeyDown={handleTitleKeyDown}
          placeholder="Untitled"
        />
      </div>

      {/* Render Database or Block Editor based on page type */}
      {currentPage.isDatabase ? (
        <DatabaseContainer pageId={currentPage.id} />
      ) : currentPage.parentId === 'toig-hq-database-page-id' ? (
        <>
          <AgencyDetailDashboard pageId={currentPage.id} />
          <div style={{ marginTop: 'var(--space-6)' }}>
            <h3 style={{
              fontSize: 'var(--text-xs)',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text-tertiary)',
              marginBottom: 'var(--space-3)',
              borderBottom: '1px solid var(--color-border-subtle)',
              paddingBottom: 'var(--space-2)'
            }}>
              Custom Agency Document & Notes
            </h3>
            <BlockEditor pageId={currentPage.id} />
          </div>
        </>
      ) : (
        <BlockEditor pageId={currentPage.id} />
      )}
    </div>
  );
}
