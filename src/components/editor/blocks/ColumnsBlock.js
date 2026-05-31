'use client';

import { useEditorStore } from '@/lib/store/useEditorStore';
import BlockEditor from '../BlockEditor';
import styles from '@/styles/editor.module.css';

/**
 * ColumnsBlock — horizontal layout container.
 * Finds all child column blocks and instantiates a nested BlockEditor for each.
 */
export default function ColumnsBlock({ block, readOnly = false }) {
  const blocks = useEditorStore((state) => state.blocks);

  // Find all child column containers belonging to this columns block
  const columns = blocks
    .filter((b) => b.parentBlockId === block.id && b.type === 'column')
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className={styles.columnsContainer}>
      {columns.map((col, index) => {
        // Evenly distribute columns or use specific width
        const width = col.properties?.width || `${100 / columns.length}%`;
        const colStyle = {
          flex: `1 1 ${width}`,
        };

        return (
          <div
            key={col.id}
            className={styles.column}
            style={colStyle}
            id={`column-${col.id}`}
          >
            {/* Render a nested BlockEditor for the contents inside this specific column */}
            <BlockEditor pageId={block.pageId} parentBlockId={col.id} readOnly={readOnly} />
          </div>
        );
      })}
    </div>
  );
}
