'use client';

import { useRef, useEffect } from 'react';
import styles from '@/styles/editor.module.css';

const headingStyles = {
  h1: styles.heading1,
  h2: styles.heading2,
  h3: styles.heading3,
  h4: styles.heading4,
};

const placeholders = {
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  h4: 'Heading 4',
};

/**
 * HeadingBlock — H1, H2, H3, H4 with appropriate typography.
 */
export default function HeadingBlock({ block, onUpdate, onKeyDown, onInput, autoFocus, readOnly = false }) {
  const level = block.type;
  const ref = useRef(null);
  const blockIdRef = useRef(block.id);

  useEffect(() => {
    if (ref.current && blockIdRef.current !== block.id) {
      ref.current.innerText = block.content?.text || '';
      blockIdRef.current = block.id;
    }
  }, [block.id, block.content?.text]);

  useEffect(() => {
    if (ref.current && autoFocus) {
      requestAnimationFrame(() => ref.current.focus());
    }
  }, [autoFocus]);

  return (
    <div
      ref={ref}
      className={`${styles.blockContent} ${headingStyles[level] || styles.heading2}`}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      data-placeholder={placeholders[level] || 'Heading'}
      onInput={(e) => {
        onUpdate({ content: { text: e.target.innerText } });
        if (onInput) onInput(e);
      }}
      onKeyDown={onKeyDown}
    />
  );
}
