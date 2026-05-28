'use client';

import { useCallback } from 'react';
import { ChevronRight, Plus, MoreHorizontal, Trash2, Copy, FileText } from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import Dropdown, { DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import styles from '@/styles/layout.module.css';

/**
 * PageTree — recursive page navigation tree for the sidebar.
 * Supports nesting, expand/collapse, and page actions.
 */
export default function PageTree({ parentId = null, depth = 0 }) {
  const {
    pages,
    currentPage,
    expandedPages,
    togglePageExpanded,
    setCurrentPage,
    addPage,
    deletePage,
  } = useWorkspaceStore();

  const children = pages
    .filter((p) => p.parentId === parentId && !p.isArchived)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (children.length === 0 && depth === 0) {
    return (
      <div className={styles.pageTreeEmpty}>
        No pages yet. Click + to create one.
      </div>
    );
  }

  return (
    <div className={depth > 0 ? styles.pageTreeChildren : undefined}>
      {children.map((page) => (
        <PageTreeItem
          key={page.id}
          page={page}
          depth={depth}
          isActive={currentPage?.id === page.id}
          isExpanded={expandedPages.has(page.id)}
          onToggle={() => togglePageExpanded(page.id)}
          onSelect={() => setCurrentPage(page)}
          onAddChild={() =>
            addPage({
              title: '',
              icon: '📄',
              parentId: page.id,
              isDatabase: false,
            })
          }
          onDelete={() => deletePage(page.id)}
          hasChildren={pages.some(
            (p) => p.parentId === page.id && !p.isArchived
          )}
        />
      ))}
    </div>
  );
}

function PageTreeItem({
  page,
  depth,
  isActive,
  isExpanded,
  onToggle,
  onSelect,
  onAddChild,
  onDelete,
  hasChildren,
}) {
  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      onSelect();
    },
    [onSelect]
  );

  const handleChevronClick = useCallback(
    (e) => {
      e.stopPropagation();
      onToggle();
    },
    [onToggle]
  );

  return (
    <>
      <div
        className={`${styles.pageTreeItem} ${
          isActive ? styles.pageTreeItemActive : ''
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {/* Expand/Collapse chevron */}
        <button
          className={`${styles.pageTreeChevron} ${
            isExpanded ? styles.pageTreeChevronExpanded : ''
          }`}
          onClick={handleChevronClick}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          <ChevronRight size={12} />
        </button>

        {/* Page icon */}
        <span className={styles.pageTreeIcon}>{page.icon || '📄'}</span>

        {/* Page title */}
        <span className={styles.pageTreeTitle}>
          {page.title || 'Untitled'}
        </span>

        {/* Actions */}
        <div className={styles.pageTreeActions}>
          <Dropdown
            trigger={
              <button
                className={styles.pageTreeActionBtn}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal size={14} />
              </button>
            }
            align="right"
          >
            <DropdownItem
              icon={<Plus size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                onAddChild();
              }}
            >
              Add sub-page
            </DropdownItem>
            <DropdownItem icon={<Copy size={14} />}>Duplicate</DropdownItem>
            <DropdownDivider />
            <DropdownItem
              icon={<Trash2 size={14} />}
              danger
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              Move to trash
            </DropdownItem>
          </Dropdown>

          <button
            className={styles.pageTreeActionBtn}
            onClick={(e) => {
              e.stopPropagation();
              onAddChild();
            }}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Render children if expanded */}
      {isExpanded && hasChildren && (
        <PageTree parentId={page.id} depth={depth + 1} />
      )}
    </>
  );
}
