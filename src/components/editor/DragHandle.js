'use client';

import { useRef, useCallback } from 'react';
import { GripVertical } from 'lucide-react';
import styles from '@/styles/editor.module.css';

/**
 * DragHandle — a draggable grip icon for reordering blocks.
 * Supports native HTML5 drag events and visual feedback.
 */
export default function DragHandle({
  blockId,
  index,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onClick,
}) {
  const handleRef = useRef(null);

  const handleDragStart = useCallback(
    (e) => {
      // Set drag data
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', blockId);

      // Add dragging class for visual feedback
      const blockEl = document.getElementById(`block-${blockId}`);
      if (blockEl) {
        setTimeout(() => {
          blockEl.style.opacity = '0.4';
          blockEl.style.transition = 'opacity 0.15s';
        }, 0);
      }

      if (onDragStart) onDragStart(e, blockId, index);
    },
    [blockId, index, onDragStart]
  );

  const handleDragEnd = useCallback(
    (e) => {
      // Remove dragging visual
      const blockEl = document.getElementById(`block-${blockId}`);
      if (blockEl) {
        blockEl.style.opacity = '1';
      }

      if (onDragEnd) onDragEnd(e, blockId, index);
    },
    [blockId, index, onDragEnd]
  );

  const handleDragOver = useCallback(
    (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (onDragOver) onDragOver(e, blockId, index);
    },
    [blockId, index, onDragOver]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      const draggedBlockId = e.dataTransfer.getData('text/plain');
      if (onDrop) onDrop(e, draggedBlockId, blockId, index);
    },
    [blockId, index, onDrop]
  );

  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (onClick) onClick(e, blockId);
    },
    [blockId, onClick]
  );

  return (
    <button
      ref={handleRef}
      className={`${styles.blockControlBtn} ${styles.dragHandle}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      title="Drag to reorder"
      aria-label="Drag handle"
    >
      <GripVertical size={14} />
    </button>
  );
}
