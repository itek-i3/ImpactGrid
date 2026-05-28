'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Check } from 'lucide-react';
import { useDatabaseStore } from '@/lib/store/useDatabaseStore';
import styles from '@/styles/database.module.css';

/**
 * Renders a single cell based on its property type.
 */
function CellRenderer({ row, property, value, onUpdate, readOnly }) {
  const [editing, setEditing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  // ── Checkbox ──
  if (property.type === 'checkbox') {
    return (
      <div className={styles.cellWrapper}>
        <input
          type="checkbox"
          className={styles.cellCheckbox}
          checked={!!value}
          disabled={readOnly}
          onChange={(e) => onUpdate(e.target.checked)}
        />
      </div>
    );
  }

  // ── Select ──
  if (property.type === 'select') {
    const options = property.config?.options || [];
    const selected = options.find((o) => o.value === value);

    return (
      <div className={styles.cellWrapper} style={{ position: 'relative' }}>
        {selected ? (
          <span
            className={styles.selectBadge}
            style={{ background: selected.color + '22', color: selected.color, cursor: readOnly ? 'default' : 'pointer' }}
            onClick={() => !readOnly && setShowDropdown(!showDropdown)}
          >
            {selected.value}
          </span>
        ) : (
          <span
            style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', cursor: readOnly ? 'default' : 'pointer' }}
            onClick={() => !readOnly && setShowDropdown(!showDropdown)}
          >
            {readOnly ? '' : 'Select...'}
          </span>
        )}
        {!readOnly && showDropdown && (
          <div className={styles.cellSelectDropdown}>
            {options.map((opt) => (
              <button
                key={opt.value}
                className={styles.cellSelectOption}
                onClick={() => {
                  onUpdate(opt.value);
                  setShowDropdown(false);
                }}
              >
                <span
                  className={styles.selectBadge}
                  style={{ background: opt.color + '22', color: opt.color }}
                >
                  {opt.value}
                </span>
                {value === opt.value && <Check size={14} style={{ marginLeft: 'auto' }} />}
              </button>
            ))}
            <button
              className={styles.cellSelectOption}
              onClick={() => { onUpdate(''); setShowDropdown(false); }}
              style={{ color: 'var(--color-text-muted)' }}
            >
              Clear
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Multi Select ──
  if (property.type === 'multi_select') {
    const options = property.config?.options || [];
    const selected = Array.isArray(value) ? value : [];

    return (
      <div className={styles.cellWrapper} style={{ position: 'relative' }}>
        <div className={styles.multiSelectWrapper} onClick={() => !readOnly && setShowDropdown(!showDropdown)} style={{ cursor: readOnly ? 'default' : 'pointer' }}>
          {selected.length > 0 ? (
            selected.map((v) => {
              const opt = options.find((o) => o.value === v);
              return (
                <span
                  key={v}
                  className={styles.selectBadge}
                  style={{ background: (opt?.color || '#8b8fa3') + '22', color: opt?.color || '#8b8fa3' }}
                >
                  {v}
                </span>
              );
            })
          ) : (
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              {readOnly ? '' : 'Select...'}
            </span>
          )}
        </div>
        {!readOnly && showDropdown && (
          <div className={styles.cellSelectDropdown}>
            {options.map((opt) => {
              const isSelected = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  className={styles.cellSelectOption}
                  onClick={() => {
                    const newVal = isSelected
                      ? selected.filter((v) => v !== opt.value)
                      : [...selected, opt.value];
                    onUpdate(newVal);
                  }}
                >
                  <span
                    className={styles.selectBadge}
                    style={{ background: opt.color + '22', color: opt.color }}
                  >
                    {opt.value}
                  </span>
                  {isSelected && <Check size={14} style={{ marginLeft: 'auto' }} />}
                </button>
              );
            })}
            <button
              className={styles.cellSelectOption}
              onClick={() => setShowDropdown(false)}
              style={{ color: 'var(--color-text-muted)', justifyContent: 'center' }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Date ──
  if (property.type === 'date') {
    return (
      <div className={styles.cellWrapper}>
        <input
          ref={inputRef}
          type="date"
          className={styles.cellInput}
          value={value || ''}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => onUpdate(e.target.value)}
        />
      </div>
    );
  }

  // ── Number ──
  if (property.type === 'number') {
    return (
      <div className={styles.cellWrapper}>
        <input
          ref={inputRef}
          type="number"
          className={styles.cellInput}
          value={value ?? ''}
          placeholder={readOnly ? '' : '0'}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => onUpdate(Number(e.target.value))}
          onFocus={() => !readOnly && setEditing(true)}
          onBlur={() => !readOnly && setEditing(false)}
        />
      </div>
    );
  }

  // ── Default: Text ──
  return (
    <div className={styles.cellWrapper}>
      <input
        ref={inputRef}
        type="text"
        className={styles.cellInput}
        value={value ?? ''}
        placeholder={readOnly ? '' : property.type === 'url' ? 'https://...' : property.type === 'email' ? 'email@...' : ''}
        readOnly={readOnly}
        disabled={readOnly}
        onChange={(e) => onUpdate(e.target.value)}
        onFocus={() => !readOnly && setEditing(true)}
        onBlur={() => !readOnly && setEditing(false)}
      />
    </div>
  );
}

/**
 * TableView — spreadsheet-like table with editable cells.
 */
export default function TableView({ readOnly = false }) {
  const { properties, rows, addRow, addProperty, updateCell, deleteRow, getFilteredRows } =
    useDatabaseStore();

  const filteredRows = getFilteredRows();
  const sortedProps = [...properties].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleAddRow = useCallback(() => {
    if (readOnly) return;
    addRow();
  }, [addRow, readOnly]);

  const handleAddProperty = useCallback(() => {
    if (readOnly) return;
    addProperty({ name: 'New Column', type: 'text' });
  }, [addProperty, readOnly]);

  return (
    <div>
      <div className={styles.tableWrapper}>
        <table className={styles.dbTable}>
          <thead>
            <tr>
              {sortedProps.map((prop) => (
                <th key={prop.id}>{prop.name}</th>
              ))}
              {!readOnly && (
                <th style={{ minWidth: '80px', width: '80px' }}>
                  <button className={styles.addPropertyBtn} onClick={handleAddProperty}>
                    <Plus size={12} /> New
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id}>
                {sortedProps.map((prop) => (
                  <td key={prop.id}>
                    <CellRenderer
                      row={row}
                      property={prop}
                      value={row.cells?.[prop.id]}
                      onUpdate={(val) => updateCell(row.id, prop.id, val)}
                      readOnly={readOnly}
                    />
                  </td>
                ))}
                {!readOnly && <td />}
              </tr>
            ))}
          </tbody>
        </table>

        {!readOnly && (
          <button className={styles.addRowBtn} onClick={handleAddRow}>
            <Plus size={14} /> New row
          </button>
        )}
      </div>

      <div className={styles.rowCount}>
        {filteredRows.length} row{filteredRows.length !== 1 ? 's' : ''}
        {filteredRows.length !== rows.length && ` (filtered from ${rows.length})`}
      </div>
    </div>
  );
}
