'use client';

import styles from '@/styles/editor.module.css';

/**
 * DividerBlock — visual horizontal rule separator.
 */
export default function DividerBlock() {
  return (
    <div className={styles.divider}>
      <div className={styles.dividerLine} />
    </div>
  );
}
