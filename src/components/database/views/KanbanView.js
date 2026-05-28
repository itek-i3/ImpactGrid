'use client';

import { useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useDatabaseStore } from '@/lib/store/useDatabaseStore';
import styles from '@/styles/database.module.css';

/**
 * KanbanView — cards grouped by a select property (columns).
 */
export default function KanbanView({ readOnly = false }) {
  const { properties, views, activeViewId, addRow, updateCell, deleteRow, getFilteredRows } =
    useDatabaseStore();

  const filteredRows = getFilteredRows();
  const activeView = views.find((v) => v.id === activeViewId);

  // Find the groupBy property (default: first select property)
  const groupByPropId =
    activeView?.config?.groupByPropertyId ||
    properties.find((p) => p.type === 'select')?.id;

  const groupByProp = properties.find((p) => p.id === groupByPropId);
  const nameProperty = properties.find((p) => p.sortOrder === 0) || properties[0];
  const tagsProp = properties.find((p) => p.type === 'multi_select');
  const priorityProp = properties.find((p) => p.name === 'Priority');

  // Drag and drop handlers
  const handleDragStart = useCallback(
    (e, rowId) => {
      if (readOnly) return;
      e.dataTransfer.setData('text/plain', rowId);
    },
    [readOnly]
  );

  const handleDragOver = useCallback(
    (e) => {
      if (readOnly) return;
      e.preventDefault();
    },
    [readOnly]
  );

  const handleDrop = useCallback(
    (e, columnValue) => {
      if (readOnly) return;
      e.preventDefault();
      const rowId = e.dataTransfer.getData('text/plain');
      if (rowId) {
        updateCell(rowId, groupByPropId, columnValue === 'No Status' ? '' : columnValue);
      }
    },
    [readOnly, updateCell, groupByPropId]
  );

  if (!groupByProp) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        No select property found to group by. Add a select property to use Kanban view.
      </div>
    );
  }

  // Build columns from the select options + "No Status"
  const options = groupByProp.config?.options || [];
  const columns = [
    ...options.map((opt) => ({
      value: opt.value,
      color: opt.color,
      rows: filteredRows.filter((r) => r.cells?.[groupByPropId] === opt.value),
    })),
    {
      value: 'No Status',
      color: '#5c5f73',
      rows: filteredRows.filter(
        (r) => !r.cells?.[groupByPropId] || !options.some((o) => o.value === r.cells?.[groupByPropId])
      ),
    },
  ].filter((col) => col.rows.length > 0 || options.some((o) => o.value === col.value));

  const handleAddCard = useCallback(
    (statusValue) => {
      if (readOnly) return;
      addRow({
        cells: groupByPropId ? { [groupByPropId]: statusValue } : {},
      });
    },
    [addRow, groupByPropId, readOnly]
  );

  return (
    <div className={styles.kanban}>
      {columns.map((column) => (
        <div key={column.value} className={styles.kanbanColumn}>
          <div className={styles.kanbanColumnHeader}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                className={styles.selectBadge}
                style={{ background: column.color + '22', color: column.color }}
              >
                {column.value}
              </span>
            </span>
            <span className={styles.kanbanColumnCount}>{column.rows.length}</span>
          </div>

          <div
            className={styles.kanbanCards}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.value)}
          >
            {column.rows.map((row) => (
              <div
                key={row.id}
                className={styles.kanbanCard}
                draggable={!readOnly}
                onDragStart={(e) => handleDragStart(e, row.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div className={styles.kanbanCardTitle}>
                    {row.cells?.[nameProperty?.id] || 'Untitled'}
                  </div>
                  {!readOnly && (
                    <button
                      className={styles.kanbanCardDelete}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRow(row.id);
                      }}
                      title="Delete card"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <div className={styles.kanbanCardMeta}>
                  {/* Priority badge */}
                  {priorityProp && row.cells?.[priorityProp.id] && (() => {
                    const opt = priorityProp.config?.options?.find(
                      (o) => o.value === row.cells[priorityProp.id]
                    );
                    return opt ? (
                      <span
                        className={styles.kanbanCardTag}
                        style={{ background: opt.color + '22', color: opt.color }}
                      >
                        {opt.value}
                      </span>
                    ) : null;
                  })()}

                  {/* Tags */}
                  {tagsProp &&
                    Array.isArray(row.cells?.[tagsProp.id]) &&
                    row.cells[tagsProp.id].map((tag) => {
                      const opt = tagsProp.config?.options?.find((o) => o.value === tag);
                      return (
                        <span
                          key={tag}
                          className={styles.kanbanCardTag}
                          style={{
                            background: (opt?.color || '#8b8fa3') + '22',
                            color: opt?.color || '#8b8fa3',
                          }}
                        >
                          {tag}
                        </span>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>

          {!readOnly && (
            <button
              className={styles.kanbanAddCard}
              onClick={() => handleAddCard(column.value)}
            >
              <Plus size={14} /> New
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
