'use client';

import { useState, useRef, useEffect } from 'react';
import styles from '@/styles/components.module.css';

/**
 * Dropdown menu component.
 * Renders a trigger element and a dropdown menu on click.
 */
export default function Dropdown({
  trigger,
  children,
  align = 'left',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className={`${styles.dropdownContainer} ${className}`} ref={ref}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          className={`${styles.dropdownMenu} ${
            align === 'right' ? styles.dropdownMenuRight : ''
          }`}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// Subcomponents for Dropdown
export function DropdownItem({ children, icon, danger = false, onClick }) {
  return (
    <div
      className={`${styles.dropdownItem} ${
        danger ? styles.dropdownItemDanger : ''
      }`}
      onClick={onClick}
    >
      {icon && <span className={styles.dropdownItemIcon}>{icon}</span>}
      {children}
    </div>
  );
}

export function DropdownDivider() {
  return <div className={styles.dropdownDivider} />;
}

export function DropdownLabel({ children }) {
  return <div className={styles.dropdownLabel}>{children}</div>;
}
