'use client';

import { useRef, useCallback, useState } from 'react';
import { GripVertical, Plus } from 'lucide-react';
import styles from '@/styles/editor.module.css';

/**
 * Block — individual block wrapper component.
 * Provides drag handle, add button, styling wrapper, selection state, and drag-and-drop reordering.
 */
export default function Block({
  block,
  index,
  isActive,
  isSelected,
  readOnly,
  onSelect,
  onAddBelow,
  onGripClick,
  onMoveBlock,
  children,
}) {
  const wrapperRef = useRef(null);
  const [dropPosition, setDropPosition] = useState(null); // 'top' | 'bottom' | null

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

  const handleDragStart = useCallback(
    (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', block.id);
      if (wrapperRef.current) {
        wrapperRef.current.style.opacity = '0.4';
      }
    },
    [block.id]
  );

  const handleDragEnd = useCallback(() => {
    if (wrapperRef.current) {
      wrapperRef.current.style.opacity = '1';
    }
    setDropPosition(null);
  }, []);

  const handleDragOver = useCallback(
    (e) => {
      if (readOnly) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          setDropPosition('top');
        } else {
          setDropPosition('bottom');
        }
      }
    },
    [readOnly]
  );

  const handleDragLeave = useCallback(() => {
    setDropPosition(null);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      if (readOnly) return;
      e.preventDefault();
      const draggedBlockId = e.dataTransfer.getData('text/plain');
      const targetPos = dropPosition === 'top' ? 'before' : 'after';
      setDropPosition(null);
      if (wrapperRef.current) {
        wrapperRef.current.style.opacity = '1';
      }
      if (draggedBlockId && draggedBlockId !== block.id && onMoveBlock) {
        onMoveBlock(draggedBlockId, block.id, targetPos);
      }
    },
    [readOnly, dropPosition, block.id, onMoveBlock]
  );

  return (
    <div
      ref={wrapperRef}
      className={`${styles.blockWrapper} ${
        isActive ? styles.blockActive || '' : ''
      } ${isSelected ? styles.blockSelected || '' : ''} ${
        dropPosition === 'top' ? styles.dropIndicatorTop || '' : ''
      } ${dropPosition === 'bottom' ? styles.dropIndicatorBottom || '' : ''}`}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
            title="Drag to reorder / Click for actions"
            onClick={handleGripClick}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
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
