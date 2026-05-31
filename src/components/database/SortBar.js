'use client';

import { useState, useCallback } from 'react';
import { ArrowUpDown, Plus, X, ArrowUp, ArrowDown } from 'lucide-react';
import { useDatabaseStore } from '@/lib/store/useDatabaseStore';
import styles from '@/styles/database.module.css';

/**
 * SortBar — multi-column sorting UI for database views.
 * Renders active sorts with direction toggles and an "add sort" dropdown.
 */
export default function SortBar() {
  const {
    sorts,
    properties,
    addSort,
    removeSort,
    setSorts,
  } = useDatabaseStore();

  const [showAddMenu, setShowAddMenu] = useState(false);

  const handleAddSort = useCallback(
    (propertyId) => {
      addSort({ propertyId, direction: 'asc' });
      setShowAddMenu(false);
    },
    [addSort]
  );

  const handleToggleDirection = useCallback(
    (sortId) => {
      setSorts(
        sorts.map((s) =>
          s.id === sortId
            ? { ...s, direction: s.direction === 'asc' ? 'desc' : 'asc' }
            : s
        )
      );
    },
    [sorts, setSorts]
  );

  const handleChangeProperty = useCallback(
    (sortId, propertyId) => {
      setSorts(
        sorts.map((s) =>
          s.id === sortId ? { ...s, propertyId } : s
        )
      );
    },
    [sorts, setSorts]
  );

  if (sorts.length === 0 && !showAddMenu) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)',
      padding: 'var(--space-3)',
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border-subtle)',
      borderRadius: 'var(--radius-lg)',
      marginBottom: 'var(--space-3)',
      animation: 'fadeInDown 0.12s ease forwards',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          <ArrowUpDown size={12} />
          Sort
        </span>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              padding: '2px var(--space-2)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-accent-primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Plus size={12} />
            Add sort
          </button>

          {showAddMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              padding: 'var(--space-1)',
              zIndex: 'var(--z-popover)',
              minWidth: '180px',
              animation: 'fadeInDown 0.12s ease forwards',
            }}>
              {properties.map((prop) => (
                <button
                  key={prop.id}
                  className={styles.cellSelectOption}
                  onClick={() => handleAddSort(prop.id)}
                >
                  {prop.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Sorts */}
      {sorts.map((sort, idx) => {
        const prop = properties.find((p) => p.id === sort.propertyId);

        return (
          <div
            key={sort.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {/* Priority label */}
            <span style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              minWidth: '32px',
            }}>
              {idx === 0 ? 'Sort by' : 'then'}
            </span>

            {/* Property selector */}
            <select
              value={sort.propertyId}
              onChange={(e) =>
                handleChangeProperty(sort.id, e.target.value)
              }
              style={{
                padding: '2px var(--space-2)',
                fontSize: 'var(--text-xs)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Direction toggle */}
            <button
              onClick={() => handleToggleDirection(sort.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                padding: '2px var(--space-2)',
                fontSize: 'var(--text-xs)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
              }}
            >
              {sort.direction === 'asc' ? (
                <>
                  <ArrowUp size={12} /> Ascending
                </>
              ) : (
                <>
                  <ArrowDown size={12} /> Descending
                </>
              )}
            </button>

            {/* Remove */}
            <button
              onClick={() => removeSort(sort.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                flexShrink: 0,
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
