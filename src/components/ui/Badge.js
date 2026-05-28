'use client';

import styles from '@/styles/components.module.css';

/**
 * Badge component for status indicators.
 * Variants: default, primary, success, warning, error, info.
 */
export default function Badge({
  children,
  variant = 'default',
  dot = false,
  className = '',
}) {
  const variantClass = {
    default: styles.badgeDefault,
    primary: styles.badgePrimary,
    success: styles.badgeSuccess,
    warning: styles.badgeWarning,
    error: styles.badgeError,
    info: styles.badgeInfo,
  }[variant];

  return (
    <span className={`${styles.badge} ${variantClass} ${className}`}>
      {dot && <span className={styles.badgeDot} />}
      {children}
    </span>
  );
}
