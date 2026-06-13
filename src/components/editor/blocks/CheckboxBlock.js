'use client';

import { useRef, useEffect } from 'react';
import styles from '@/styles/editor.module.css';

/**
 * CheckboxBlock — todo item with checked state and strikethrough.
 */
export default function CheckboxBlock({ block, onUpdate, onKeyDown, onInput, autoFocus, readOnly = false }) {
  const checked = block.properties?.checked || false;
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
    <div className={styles.checkbox}>
      <input
        type="checkbox"
        className={styles.checkboxInput}
        checked={checked}
        disabled={readOnly}
        onChange={(e) =>
          !readOnly && onUpdate({
            properties: { ...block.properties, checked: e.target.checked },
          })
        }
      />
      <div
        ref={ref}
        className={`${styles.checkboxText} ${
          checked ? styles.checkboxChecked : ''
        }`}
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
