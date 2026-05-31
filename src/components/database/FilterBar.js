'use client';

import { useState, useCallback } from 'react';
import { Filter, Plus, X, ChevronDown } from 'lucide-react';
import { useDatabaseStore } from '@/lib/store/useDatabaseStore';
import styles from '@/styles/database.module.css';

const OPERATORS = [
  { value: 'contains', label: 'Contains' },
  { value: 'does_not_contain', label: 'Does not contain' },
  { value: 'equals', label: 'Equals' },
  { value: 'does_not_equal', label: 'Does not equal' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
];

/**
 * FilterBar — multi-condition filter UI for database views.
 * Renders active filters with inline editing and an "add filter" dropdown.
 */
export default function FilterBar() {
  const {
    filters,
    properties,
    addFilter,
    removeFilter,
    setFilters,
  } = useDatabaseStore();

  const [showAddMenu, setShowAddMenu] = useState(false);

  const handleAddFilter = useCallback(
    (propertyId) => {
      addFilter({
        propertyId,
        operator: 'contains',
        value: '',
      });
      setShowAddMenu(false);
    },
    [addFilter]
  );

  const handleUpdateFilter = useCallback(
    (filterId, updates) => {
      setFilters(
        filters.map((f) =>
          f.id === filterId ? { ...f, ...updates } : f
        )
      );
    },
    [filters, setFilters]
  );

  if (filters.length === 0 && !showAddMenu) return null;

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
          <Filter size={12} />
          Filters
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
            Add filter
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
                  onClick={() => handleAddFilter(prop.id)}
                >
                  {prop.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Filters */}
      {filters.map((filter) => {
        const prop = properties.find((p) => p.id === filter.propertyId);
        const needsValue =
          filter.operator !== 'is_empty' &&
          filter.operator !== 'is_not_empty';

        return (
          <div
            key={filter.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {/* Property name */}
            <span style={{
              fontWeight: 'var(--font-medium)',
              color: 'var(--color-text-secondary)',
              whiteSpace: 'nowrap',
              minWidth: '80px',
            }}>
              {prop?.name || 'Unknown'}
            </span>

            {/* Operator */}
            <select
              value={filter.operator}
              onChange={(e) =>
                handleUpdateFilter(filter.id, { operator: e.target.value })
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
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>

            {/* Value */}
            {needsValue && (
              <input
                type="text"
                value={filter.value}
                onChange={(e) =>
                  handleUpdateFilter(filter.id, { value: e.target.value })
                }
                placeholder="value..."
                style={{
                  flex: 1,
                  padding: '2px var(--space-2)',
                  fontSize: 'var(--text-xs)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                  minWidth: '80px',
                }}
              />
            )}

            {/* Remove */}
            <button
              onClick={() => removeFilter(filter.id)}
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
