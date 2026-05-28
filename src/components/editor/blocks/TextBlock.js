'use client';

import { useRef, useEffect } from 'react';
import styles from '@/styles/editor.module.css';

/**
 * TextBlock — basic paragraph block with contentEditable.
 * Uses uncontrolled ref pattern to avoid React re-render cursor issues.
 */
export default function TextBlock({ block, onUpdate, onKeyDown, onInput, autoFocus, readOnly = false }) {
  const ref = useRef(null);
  const blockIdRef = useRef(block.id);

  // Only set innerHTML when block ID changes (switching pages/blocks)
  useEffect(() => {
    if (ref.current && blockIdRef.current !== block.id) {
      ref.current.innerText = block.content?.text || '';
      blockIdRef.current = block.id;
    }
  }, [block.id, block.content?.text]);

  // Auto-focus
  useEffect(() => {
    if (ref.current && autoFocus) {
      requestAnimationFrame(() => {
        ref.current.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(ref.current);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      });
    }
  }, [autoFocus]);

  return (
    <div
      ref={ref}
      className={styles.blockContent}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      data-placeholder="Type '/' for commands..."
      onInput={(e) => {
        onUpdate({ content: { text: e.target.innerText } });
        if (onInput) onInput(e);
      }}
      onKeyDown={onKeyDown}
    />
  );
}
