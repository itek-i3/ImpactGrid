'use client';

import { useState, useCallback } from 'react';
import {
  Table,
  Columns3,
  Calendar,
  List,
  BarChart3,
  Clock,
  LayoutDashboard,
  Plus,
  X,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useDatabaseStore } from '@/lib/store/useDatabaseStore';
import styles from '@/styles/database.module.css';

const VIEW_TYPES = [
  { type: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { type: 'table', label: 'Table', icon: Table },
  { type: 'kanban', label: 'Board', icon: Columns3 },
  { type: 'calendar', label: 'Calendar', icon: Calendar },
  { type: 'timeline', label: 'Timeline', icon: Clock },
  { type: 'list', label: 'List', icon: List },
  { type: 'chart', label: 'Chart', icon: BarChart3 },
];

/**
 * ViewSwitcher — tabbed view navigation for database pages.
 * Allows switching between views, adding new ones, renaming, and deleting.
 */
export default function ViewSwitcher() {
  const {
    views,
    activeViewId,
    setActiveViewId,
    addView,
    updateView,
    deleteView,
    properties,
  } = useDatabaseStore();

  const [showNewMenu, setShowNewMenu] = useState(false);
  const [editingViewId, setEditingViewId] = useState(null);
  const [editName, setEditName] = useState('');
  const [contextMenu, setContextMenu] = useState(null);

  const handleAddView = useCallback(
    (type) => {
      const label = VIEW_TYPES.find((v) => v.type === type)?.label || type;
      addView({
        name: `${label} View`,
        type,
        config:
          type === 'kanban'
            ? { groupByPropertyId: properties.find((p) => p.type === 'select')?.id }
            : {},
      });
      setShowNewMenu(false);
    },
    [addView, properties]
  );

  const handleRename = useCallback(
    (viewId) => {
      if (editName.trim()) {
        updateView(viewId, { name: editName.trim() });
      }
      setEditingViewId(null);
      setEditName('');
    },
    [editName, updateView]
  );

  const handleContextMenu = useCallback((e, viewId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ viewId, x: e.clientX, y: e.clientY });
  }, []);

  return (
    <div className={styles.viewTabs}>
      {views.map((view) => {
        const TypeIcon =
          VIEW_TYPES.find((vt) => vt.type === view.type)?.icon || Table;

        return editingViewId === view.id ? (
          <input
            key={view.id}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={() => handleRename(view.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename(view.id);
              if (e.key === 'Escape') {
                setEditingViewId(null);
                setEditName('');
              }
            }}
            autoFocus
            style={{
              padding: 'var(--space-1) var(--space-2)',
              fontSize: 'var(--text-sm)',
              border: '1px solid var(--color-accent-primary)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              outline: 'none',
              width: '120px',
            }}
          />
        ) : (
          <button
            key={view.id}
            className={`${styles.viewTab} ${
              view.id === activeViewId ? styles.viewTabActive : ''
            }`}
            onClick={() => setActiveViewId(view.id)}
            onContextMenu={(e) => handleContextMenu(e, view.id)}
            onDoubleClick={() => {
              setEditingViewId(view.id);
              setEditName(view.name);
            }}
          >
            <TypeIcon size={14} />
            {view.name}
          </button>
        );
      })}

      {/* Add View Button */}
      <div style={{ position: 'relative' }}>
        <button
          className={`${styles.viewTab} ${styles.viewTabAdd}`}
          onClick={() => setShowNewMenu(!showNewMenu)}
        >
          <Plus size={14} />
        </button>

        {showNewMenu && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              padding: 'var(--space-1)',
              zIndex: 'var(--z-popover)',
              minWidth: '160px',
              animation: 'fadeInDown 0.12s ease forwards',
            }}
          >
            {VIEW_TYPES.map((vt) => (
              <button
                key={vt.type}
                className={styles.cellSelectOption}
                onClick={() => handleAddView(vt.type)}
              >
                <vt.icon size={14} />
                {vt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 'var(--z-popover)',
            }}
            onClick={() => setContextMenu(null)}
          />
          <div
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              padding: 'var(--space-1)',
              zIndex: 'var(--z-modal)',
              minWidth: '140px',
              animation: 'fadeInDown 0.12s ease forwards',
            }}
          >
            <button
              className={styles.cellSelectOption}
              onClick={() => {
                const view = views.find((v) => v.id === contextMenu.viewId);
                if (view) {
                  setEditingViewId(view.id);
                  setEditName(view.name);
                }
                setContextMenu(null);
              }}
            >
              <Pencil size={14} />
              Rename
            </button>
            <button
              className={styles.cellSelectOption}
              style={{ color: '#ef4444' }}
              onClick={() => {
                deleteView(contextMenu.viewId);
                setContextMenu(null);
              }}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
