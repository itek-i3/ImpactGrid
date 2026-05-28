'use client';

import { useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import styles from '@/styles/editor.module.css';

/**
 * TableBlock — simple editable table with add/remove row/column.
 */
export default function TableBlock({ block, onUpdate, readOnly = false }) {
  const rows = block.content?.rows || [
    ['Header 1', 'Header 2', 'Header 3'],
    ['', '', ''],
    ['', '', ''],
  ];

  const updateCell = useCallback(
    (rowIndex, colIndex, value) => {
      const newRows = rows.map((row, ri) =>
        ri === rowIndex
          ? row.map((cell, ci) => (ci === colIndex ? value : cell))
          : [...row]
      );
      onUpdate({ content: { ...block.content, rows: newRows } });
    },
    [rows, block.content, onUpdate]
  );

  const addRow = useCallback(() => {
    const cols = rows[0]?.length || 3;
    const newRows = [...rows, new Array(cols).fill('')];
    onUpdate({ content: { ...block.content, rows: newRows } });
  }, [rows, block.content, onUpdate]);

  const addColumn = useCallback(() => {
    const newRows = rows.map((row, i) => [
      ...row,
      i === 0 ? `Header ${row.length + 1}` : '',
    ]);
    onUpdate({ content: { ...block.content, rows: newRows } });
  }, [rows, block.content, onUpdate]);

  const removeRow = useCallback(
    (index) => {
      if (rows.length <= 2) return; // Keep at least header + 1 row
      const newRows = rows.filter((_, i) => i !== index);
      onUpdate({ content: { ...block.content, rows: newRows } });
    },
    [rows, block.content, onUpdate]
  );

  const removeColumn = useCallback(
    (colIndex) => {
      if ((rows[0]?.length || 0) <= 1) return;
      const newRows = rows.map((row) => row.filter((_, ci) => ci !== colIndex));
      onUpdate({ content: { ...block.content, rows: newRows } });
    },
    [rows, block.content, onUpdate]
  );

  return (
    <div className={styles.tableBlock}>
      <table className={styles.table}>
        <thead>
          <tr>
            {rows[0]?.map((cell, ci) => (
              <th
                key={ci}
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onBlur={(e) => !readOnly && updateCell(0, ci, e.target.innerText)}
                dangerouslySetInnerHTML={{ __html: cell }}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(1).map((row, ri) => (
            <tr key={ri + 1}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onBlur={(e) => !readOnly && updateCell(ri + 1, ci, e.target.innerText)}
                  dangerouslySetInnerHTML={{ __html: cell }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {!readOnly && (
        <div className={styles.tableControls}>
          <button className={styles.tableControlBtn} onClick={addRow}>
            <Plus size={12} /> Row
          </button>
          <button className={styles.tableControlBtn} onClick={addColumn}>
            <Plus size={12} /> Column
          </button>
          {rows.length > 2 && (
            <button
              className={styles.tableControlBtn}
              onClick={() => removeRow(rows.length - 1)}
            >
              <Trash2 size={12} /> Row
            </button>
          )}
          {(rows[0]?.length || 0) > 1 && (
            <button
              className={styles.tableControlBtn}
              onClick={() => removeColumn(rows[0].length - 1)}
            >
              <Trash2 size={12} /> Column
            </button>
          )}
        </div>
      )}
    </div>
  );
}
