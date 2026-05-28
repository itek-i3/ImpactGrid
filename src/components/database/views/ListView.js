'use client';

import { useDatabaseStore } from '@/lib/store/useDatabaseStore';
import styles from '@/styles/database.module.css';

/**
 * ListView — compact list display of rows with key metadata.
 */
export default function ListView() {
  const { properties, getFilteredRows } = useDatabaseStore();
  const filteredRows = getFilteredRows();

  const nameProp = properties.find((p) => p.sortOrder === 0) || properties[0];
  const statusProp = properties.find((p) => p.name === 'Status' || p.type === 'select');
  const dateProp = properties.find((p) => p.type === 'date');
  const checkboxProp = properties.find((p) => p.type === 'checkbox');

  return (
    <div className={styles.listView}>
      {filteredRows.length === 0 ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          No items to display.
        </div>
      ) : (
        filteredRows.map((row) => {
          const statusVal = statusProp ? row.cells?.[statusProp.id] : null;
          const statusOpt = statusProp?.config?.options?.find((o) => o.value === statusVal);
          const dateVal = dateProp ? row.cells?.[dateProp.id] : null;
          const checked = checkboxProp ? row.cells?.[checkboxProp.id] : null;

          return (
            <div key={row.id} className={styles.listViewItem}>
              {checkboxProp && (
                <input
                  type="checkbox"
                  className={styles.cellCheckbox}
                  checked={!!checked}
                  onChange={() => {}}
                  readOnly
                />
              )}

              <div
                className={styles.listViewTitle}
                style={checked ? { textDecoration: 'line-through', color: 'var(--color-text-tertiary)' } : {}}
              >
                {row.cells?.[nameProp?.id] || 'Untitled'}
              </div>

              <div className={styles.listViewMeta}>
                {statusOpt && (
                  <span
                    className={styles.selectBadge}
                    style={{ background: statusOpt.color + '22', color: statusOpt.color }}
                  >
                    {statusOpt.value}
                  </span>
                )}

                {dateVal && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    {new Date(dateVal).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
