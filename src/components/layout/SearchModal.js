'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, FileText, Database, ArrowRight } from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import { useEditorStore } from '@/lib/store/useEditorStore';
import styles from '@/styles/layout.module.css';

/**
 * SearchModal — global search (Cmd+K) across pages and databases.
 */
export default function SearchModal() {
  const {
    searchOpen,
    setSearchOpen,
    pages,
    setCurrentPage,
  } = useWorkspaceStore();

  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, setSearchOpen]);

  // Auto-focus input on open
  useEffect(() => {
    if (searchOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
    }
  }, [searchOpen]);

  const filteredPages = pages
    .filter((p) => !p.isArchived)
    .filter((p) => {
      if (!query) return true;
      const q = query.toLowerCase();
      
      // Match page title
      if (p.title && p.title.toLowerCase().includes(q)) return true;
      
      // Match block content (from editor store)
      const blocks = useEditorStore.getState().blocksByPage?.[p.id] || [];
      return blocks.some((b) => {
        const text = b.content?.text || '';
        return text.toLowerCase().includes(q);
      });
    });

  const handleSelect = useCallback(
    (page) => {
      setCurrentPage(page);
      setSearchOpen(false);
    },
    [setCurrentPage, setSearchOpen]
  );

  if (!searchOpen) return null;

  return (
    <div
      className={styles.searchOverlay}
      onClick={() => setSearchOpen(false)}
    >
      <div
        className={styles.searchModal}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className={styles.searchInputWrapper}>
          <Search size={18} className={styles.searchInputIcon} />
          <input
            ref={inputRef}
            className={styles.searchInput}
            type="text"
            placeholder="Search pages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Results */}
        <div className={styles.searchResults}>
          {filteredPages.length === 0 ? (
            <div className={styles.searchEmpty}>
              {query ? `No results for "${query}"` : 'No pages yet'}
            </div>
          ) : (
            filteredPages.map((page) => (
              <div
                key={page.id}
                className={styles.searchResultItem}
                onClick={() => handleSelect(page)}
              >
                <span className={styles.searchResultIcon}>
                  {page.icon || (page.isDatabase ? '📊' : '📄')}
                </span>
                <div className={styles.searchResultInfo}>
                  <div className={styles.searchResultTitle}>
                    {page.title || 'Untitled'}
                  </div>
                  <div className={styles.searchResultPath}>
                    {page.isDatabase ? 'Database' : 'Page'}
                  </div>
                </div>
                <ArrowRight
                  size={14}
                  style={{ color: 'var(--color-text-muted)' }}
                />
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className={styles.searchFooter}>
          <span className={styles.searchKbd}>
            <kbd>↑↓</kbd> Navigate
          </span>
          <span className={styles.searchKbd}>
            <kbd>↵</kbd> Open
          </span>
          <span className={styles.searchKbd}>
            <kbd>Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}
