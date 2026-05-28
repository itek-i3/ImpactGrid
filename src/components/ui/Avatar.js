'use client';

import styles from '@/styles/components.module.css';

/**
 * Avatar component — displays user image or initials.
 */
export default function Avatar({
  src,
  alt,
  name,
  size = 'md',
  className = '',
}) {
  const sizeClass = {
    sm: styles.avatarSm,
    md: styles.avatarMd,
    lg: styles.avatarLg,
    xl: styles.avatarXl,
  }[size];

  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <div className={`${styles.avatar} ${sizeClass} ${className}`}>
      {src ? (
        <img src={src} alt={alt || name || 'Avatar'} />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
