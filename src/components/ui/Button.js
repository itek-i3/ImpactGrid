'use client';

import styles from '@/styles/components.module.css';

/**
 * Button component with variants: primary, secondary, ghost, danger.
 * Sizes: sm, md (default), lg, icon, icon-sm.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  icon,
  className = '',
  ...props
}) {
  const variantClass = {
    primary: styles.btnPrimary,
    secondary: styles.btnSecondary,
    ghost: styles.btnGhost,
    danger: styles.btnDanger,
  }[variant];

  const sizeClass = {
    sm: styles.btnSm,
    md: '',
    lg: styles.btnLg,
    icon: styles.btnIcon,
    'icon-sm': styles.btnIconSm,
  }[size];

  return (
    <button
      className={`${styles.btn} ${variantClass} ${sizeClass} ${
        fullWidth ? styles.btnFullWidth : ''
      } ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="animate-spin" style={{ width: 16, height: 16 }}>
          ⟳
        </span>
      ) : (
        <>
          {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}
