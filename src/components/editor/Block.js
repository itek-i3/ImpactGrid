'use client';

import { useRef, useCallback } from 'react';
import { GripVertical, Plus } from 'lucide-react';
import styles from '@/styles/editor.module.css';

/**
 * Block — individual block wrapper component.
 * Provides drag handle, add button, styling wrapper, and selection state.
 * Used by BlockEditor to wrap each block type component.
 */
export default function Block({
  block,
  index,
  isActive,
  isSelected,
  readOnly,
  onSelect,
  onAddBelow,
  onDragStart,
  onGripClick,
  children,
}) {
  const wrapperRef = useRef(null);

  const handleAddBelow = useCallback(
    (e) => {
      e.stopPropagation();
      if (onAddBelow) onAddBelow(block.id);
    },
    [block.id, onAddBelow]
  );

  const handleGripClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (onGripClick) onGripClick(e, block);
    },
    [block, onGripClick]
  );

  const handleClick = useCallback(() => {
    if (!readOnly && onSelect) onSelect(block.id);
  }, [block.id, readOnly, onSelect]);

  return (
    <div
      ref={wrapperRef}
      className={`${styles.blockWrapper} ${
        isActive ? styles.blockActive || '' : ''
      } ${isSelected ? styles.blockSelected || '' : ''}`}
      onClick={handleClick}
      id={`block-${block.id}`}
      data-block-id={block.id}
      data-block-type={block.type}
    >
      {/* Block Controls — visible on hover */}
      {!readOnly && (
        <div className={styles.blockControls}>
          <button
            className={styles.blockControlBtn}
            onClick={handleAddBelow}
            title="Add block below"
          >
            <Plus size={14} />
          </button>
          <button
            className={`${styles.blockControlBtn} ${styles.dragHandle}`}
            title="Block actions"
            onClick={handleGripClick}
            draggable
            onDragStart={(e) => {
              if (onDragStart) onDragStart(e, block.id, index);
            }}
          >
            <GripVertical size={14} />
          </button>
        </div>
      )}

      {/* Block Content with Dynamic Styling */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          color: block.properties?.textColor || undefined,
          background: block.properties?.bgColor || undefined,
          padding: block.properties?.bgColor
            ? 'var(--space-1) var(--space-3)'
            : undefined,
          borderRadius: block.properties?.bgColor
            ? 'var(--radius-md)'
            : undefined,
          textAlign: block.properties?.align || undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
