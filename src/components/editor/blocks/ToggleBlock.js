'use client';

import { useRef, useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import styles from '@/styles/editor.module.css';

/**
 * ToggleBlock — collapsible section with heading and nested content.
 */
export default function ToggleBlock({ block, onUpdate, onKeyDown, onInput, autoFocus, readOnly = false }) {
  const [isOpen, setIsOpen] = useState(block.properties?.isOpen ?? true);
  const titleRef = useRef(null);
  const contentRef = useRef(null);
  const blockIdRef = useRef(block.id);

  useEffect(() => {
    if (titleRef.current && titleRef.current.innerText !== (block.content?.text || '')) {
      titleRef.current.innerText = block.content?.text || '';
    }
  }, [block.id, block.content?.text]);

  useEffect(() => {
    if (isOpen && contentRef.current && contentRef.current.innerText !== (block.properties?.innerText || '')) {
      contentRef.current.innerText = block.properties?.innerText || '';
    }
  }, [block.id, isOpen, block.properties?.innerText]);

  useEffect(() => {
    if (titleRef.current && autoFocus) {
      requestAnimationFrame(() => titleRef.current.focus());
    }
  }, [autoFocus]);

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onUpdate({ properties: { ...block.properties, isOpen: newState } });
  };

  return (
    <div className={styles.toggle}>
      <div className={styles.toggleHeader} onClick={handleToggle}>
        <span
          className={`${styles.toggleChevron} ${
            isOpen ? styles.toggleChevronOpen : ''
          }`}
        >
          <ChevronRight size={16} />
        </span>
        <div
          ref={titleRef}
          className={styles.toggleTitle}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onClick={(e) => e.stopPropagation()}
          onInput={(e) => {
            onUpdate({ content: { text: e.target.innerText } });
            if (onInput) onInput(e);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {isOpen && (
        <div className={styles.toggleContent}>
          <div
            ref={contentRef}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            className={styles.blockContent}
            data-placeholder="Toggle content..."
            style={{ minHeight: '1.7em' }}
            onInput={(e) =>
              !readOnly && onUpdate({
                properties: {
                  ...block.properties,
                  innerText: e.target.innerText,
                },
              })
            }
          />
        </div>
      )}
    </div>
  );
}
