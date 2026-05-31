'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Star,
  MoreHorizontal,
  Share2,
  MessageSquare,
  Clock,
  Menu,
  Trash2,
  Copy,
} from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { useEditorStore } from '@/lib/store/useEditorStore';
import { useToast } from '@/components/ui/Toast';
import Dropdown, { DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import styles from '@/styles/layout.module.css';

/**
 * Topbar — displays breadcrumb, save status, and page actions.
 */
export default function Topbar() {
  const router = useRouter();
  const {
    currentPage,
    sidebarOpen,
    toggleSidebar,
    updatePage,
    toggleFavoritePage,
    duplicatePage,
    deletePage,
    toggleSearch,
    workspace,
  } = useWorkspaceStore();
  const { isSaving, lastSaved } = useEditorStore();
  const toast = useToast();

  const [showPublishMenu, setShowPublishMenu] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!showPublishMenu) return;
    function handleClick() {
      setShowPublishMenu(false);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showPublishMenu]);

  const formatSaveTime = (time) => {
    if (!time) return '';
    const date = new Date(time);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 5) return 'Saved';
    if (diff < 60) return `Saved ${diff}s ago`;
    if (diff < 3600) return `Saved ${Math.floor(diff / 60)}m ago`;
    return `Saved at ${date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  };

  return (
    <header className={styles.topbar}>
      <div className={styles.topbarLeft}>
        {!sidebarOpen && (
          <button className={styles.topbarBtn} onClick={toggleSidebar}>
            <Menu size={18} />
          </button>
        )}

        {/* Breadcrumb */}
        <nav className={styles.topbarBreadcrumb}>
          {currentPage ? (
            <>
              <span className={styles.topbarBreadcrumbItem}>
                <span>{currentPage.icon || '📄'}</span>
                <span>{currentPage.title || 'Untitled'}</span>
              </span>
            </>
          ) : (
            <span className={styles.topbarBreadcrumbItem}>
              Select a page
            </span>
          )}
        </nav>

        {/* Save Status */}
        {isSaving && (
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              marginLeft: 'var(--space-2)',
            }}
          >
            Saving...
          </span>
        )}
        {!isSaving && lastSaved && (
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              marginLeft: 'var(--space-2)',
            }}
          >
            {formatSaveTime(lastSaved)}
          </span>
        )}
      </div>

      <div className={styles.topbarRight} style={{ position: 'relative' }}>
        <button
          className={`${styles.topbarBtn} ${currentPage?.isPublished ? styles.topbarBtnActive : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setShowPublishMenu(!showPublishMenu);
          }}
          title="Share to Web"
          style={{ position: 'relative' }}
        >
          <Share2 size={16} />
          {currentPage?.isPublished && (
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#10b981',
                position: 'absolute',
                top: '4px',
                right: '4px',
              }}
            />
          )}
        </button>

        {showPublishMenu && currentPage && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4)',
              boxShadow: 'var(--shadow-xl)',
              zIndex: 'var(--z-popover)',
              width: '320px',
              animation: 'fadeInDown 0.15s ease forwards',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                Publish to Web
              </span>
              <span
                style={{
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: currentPage.isPublished ? 'rgba(16, 185, 129, 0.15)' : 'var(--color-bg-active)',
                  color: currentPage.isPublished ? '#10b981' : 'var(--color-text-muted)',
                  fontWeight: 'bold',
                }}
              >
                {currentPage.isPublished ? 'Live' : 'Private'}
              </span>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
              {currentPage.isPublished
                ? 'Anyone with the link can view this page. Edits will sync instantly.'
                : 'Publish this page to share it with members, volunteers, or partners.'}
            </p>

            {currentPage.isPublished && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <input
                  type="text"
                  readOnly
                  value={`${origin}/public/${currentPage.id}`}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2)',
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text-secondary)',
                    fontSize: 'var(--text-xs)',
                    outline: 'none',
                  }}
                  onClick={(e) => e.target.select()}
                />
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    style={{
                      flex: 1,
                      padding: 'var(--space-2)',
                      background: 'var(--color-accent-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      navigator.clipboard.writeText(`${origin}/public/${currentPage.id}`);
                      toast.success('Link Copied', 'Public link copied to clipboard!');
                    }}
                  >
                    Copy Link
                  </button>
                  <a
                    href={`/public/${currentPage.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      padding: 'var(--space-2)',
                      background: 'var(--color-bg-active)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 'bold',
                      textAlign: 'center',
                      textDecoration: 'none',
                    }}
                  >
                    Open Site
                  </a>
                </div>
              </div>
            )}

            <button
              style={{
                width: '100%',
                padding: 'var(--space-2)',
                background: currentPage.isPublished ? '#ef4444' : 'var(--color-accent-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginTop: 'var(--space-1)',
              }}
              onClick={() => {
                const nextState = !currentPage.isPublished;
                updatePage(currentPage.id, { isPublished: nextState });
                if (nextState) {
                  toast.success('Page Published', 'Anyone with the link can now view this page.');
                } else {
                  toast.info('Page Unpublished', 'This page is now private.');
                }
              }}
            >
              {currentPage.isPublished ? 'Unpublish Site' : 'Publish to Web'}
            </button>
          </div>
        )}

        <button className={styles.topbarBtn} title="Comments">
          <MessageSquare size={16} />
        </button>
        <button className={styles.topbarBtn} title="History / Search" onClick={toggleSearch}>
          <Clock size={16} />
        </button>
        <button
          className={`${styles.topbarBtn} ${currentPage?.isFavorite ? styles.topbarBtnActive || '' : ''}`}
          title={currentPage?.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
          onClick={() => currentPage && toggleFavoritePage(currentPage.id)}
        >
          <Star size={16} style={{ fill: currentPage?.isFavorite ? 'var(--color-accent-primary)' : 'none', color: currentPage?.isFavorite ? 'var(--color-accent-primary)' : 'inherit' }} />
        </button>
        {currentPage && (
          <Dropdown
            trigger={
              <button className={styles.topbarBtn} title="More actions">
                <MoreHorizontal size={16} />
              </button>
            }
            align="right"
          >
            <DropdownItem
              icon={<Copy size={14} />}
              onClick={async () => {
                const dupId = await duplicatePage(currentPage.id);
                if (dupId && workspace) {
                  router.push(`/${workspace.id}/${dupId}`);
                }
              }}
            >
              Duplicate Page
            </DropdownItem>
            <DropdownDivider />
            <DropdownItem
              icon={<Trash2 size={14} />}
              danger
              onClick={async () => {
                await deletePage(currentPage.id);
                if (workspace) {
                  router.push(`/${workspace.id}`);
                }
              }}
            >
              Move to Trash
            </DropdownItem>
          </Dropdown>
        )}
      </div>
    </header>
  );
}
