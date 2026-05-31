'use client';

import { useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronRight, Plus, MoreHorizontal, Trash2, Copy, FileText, Star } from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/useWorkspaceStore';
import Dropdown, { DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import styles from '@/styles/layout.module.css';

/**
 * PageTree — recursive page navigation tree for the sidebar.
 * Supports nesting, expand/collapse, and page actions.
 */
export default function PageTree({ parentId = null, depth = 0 }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    pages,
    currentPage,
    expandedPages,
    togglePageExpanded,
    setCurrentPage,
    addPage,
    deletePage,
    duplicatePage,
    toggleFavoritePage,
    workspace,
  } = useWorkspaceStore();

  const handleSelect = (page) => {
    setCurrentPage(page);
    if (pathname && !pathname.startsWith('/demo') && workspace) {
      router.push(`/${workspace.id}/${page.id}`);
    }
  };

  const handleAddChild = async (parentId) => {
    const newId = await addPage({
      title: '',
      icon: '📄',
      parentId,
      isDatabase: false,
    });
    if (newId && pathname && !pathname.startsWith('/demo') && workspace) {
      router.push(`/${workspace.id}/${newId}`);
    }
  };

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
          onSelect={() => handleSelect(page)}
          onAddChild={() => handleAddChild(page.id)}
          onDelete={() => deletePage(page.id)}
          onDuplicate={async () => {
            const dupId = await duplicatePage(page.id);
            if (dupId && pathname && !pathname.startsWith('/demo') && workspace) {
              router.push(`/${workspace.id}/${dupId}`);
            }
          }}
          onToggleFavorite={() => toggleFavoritePage(page.id)}
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
  onDuplicate,
  onToggleFavorite,
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
            <DropdownItem
              icon={<Star size={14} style={{ fill: page.isFavorite ? 'var(--color-accent-primary)' : 'none', color: page.isFavorite ? 'var(--color-accent-primary)' : 'inherit' }} />}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
            >
              {page.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            </DropdownItem>
            <DropdownItem
              icon={<Copy size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
            >
              Duplicate
            </DropdownItem>
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
