'use client';

import { useRef, useEffect } from 'react';
import styles from '@/styles/editor.module.css';

const colorMap = {
  blue: styles.calloutBlue,
  purple: styles.calloutPurple,
  green: styles.calloutGreen,
  yellow: styles.calloutYellow,
  red: styles.calloutRed,
  gray: styles.calloutGray,
};

const defaultIcons = {
  blue: '💡',
  purple: '📝',
  green: '✅',
  yellow: '⚠️',
  red: '🚨',
  gray: '💬',
};

/**
 * CalloutBlock — colored background container with icon + text.
 */
export default function CalloutBlock({ block, onUpdate, onKeyDown, onInput, autoFocus, readOnly = false }) {
  const color = block.properties?.color || 'blue';
  const icon = block.properties?.icon || defaultIcons[color] || '💡';
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
    <div className={`${styles.callout} ${colorMap[color] || colorMap.blue}`}>
      <span
        className={styles.calloutIcon}
        onClick={() => {
          if (readOnly) return;
          const colors = Object.keys(colorMap);
          const currentIndex = colors.indexOf(color);
          const nextColor = colors[(currentIndex + 1) % colors.length];
          onUpdate({
            properties: {
              ...block.properties,
              color: nextColor,
              icon: defaultIcons[nextColor],
            },
          });
        }}
      >
        {icon}
      </span>
      <div
        ref={ref}
        className={styles.calloutContent}
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
