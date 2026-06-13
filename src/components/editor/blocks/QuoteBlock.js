'use client';

import { useRef, useEffect } from 'react';
import styles from '@/styles/editor.module.css';

/**
 * QuoteBlock — blockquote with left accent border.
 */
export default function QuoteBlock({ block, onUpdate, onKeyDown, onInput, autoFocus, readOnly = false }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      const text = block.content?.text || '';
      if (ref.current.innerText !== text) {
        ref.current.innerText = text;
      }
    }
  }, [block.id, block.content?.text]);

  useEffect(() => {
    if (ref.current && autoFocus) {
      requestAnimationFrame(() => ref.current.focus());
    }
  }, [autoFocus]);

  return (
    <div className={styles.quote}>
      <div
        ref={ref}
        className={styles.quoteContent}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        data-placeholder="Type a quote..."
        onInput={(e) => {
          onUpdate({ content: { text: e.target.innerText } });
          if (onInput) onInput(e);
        }}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
