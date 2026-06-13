'use client';

import { useRef, useEffect } from 'react';
import styles from '@/styles/editor.module.css';

/**
 * BulletListBlock — bulleted list item with bullet marker.
 */
export function BulletListBlock({ block, onUpdate, onKeyDown, onInput, autoFocus, readOnly = false }) {
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
    <div className={styles.listItem}>
      <span className={styles.listBullet}>•</span>
      <div
        ref={ref}
        className={styles.listContent}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={(e) => {
          onUpdate({ content: { text: e.target.innerText } });
          if (onInput) onInput(e);
        }}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

/**
 * NumberedListBlock — numbered list item.
 */
export function NumberedListBlock({ block, onUpdate, onKeyDown, onInput, autoFocus, listIndex, readOnly = false }) {
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
    <div className={styles.listItem}>
      <span className={styles.listBullet}>{(listIndex || 0) + 1}.</span>
      <div
        ref={ref}
        className={styles.listContent}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={(e) => {
          onUpdate({ content: { text: e.target.innerText } });
          if (onInput) onInput(e);
        }}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
