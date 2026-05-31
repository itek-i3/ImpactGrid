'use client';

/**
 * ColumnBlock — dummy component representing a single column container.
 * The columns layout is handled by ColumnsBlock.
 */
export default function ColumnBlock({ children }) {
  return <div style={{ flex: 1 }}>{children}</div>;
}
