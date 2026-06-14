'use client';

import { useState, useRef, useEffect, cloneElement, isValidElement } from 'react';
import { createPortal } from 'react-dom';
import styles from '@/styles/components.module.css';

export default function Dropdown({ trigger, children, align = 'left', className = '' }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const style = {
      position: 'fixed',
      top: rect.bottom + 4,
      zIndex: 9999,
      minWidth: 200,
    };

    if (align === 'right') {
      style.right = window.innerWidth - rect.right;
    } else {
      style.left = rect.left;
    }

    setMenuStyle(style);
  }, [open, align]);

  useEffect(() => {
    function handleClose(e) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClose);
    }
    return () => document.removeEventListener('mousedown', handleClose);
  }, [open]);

  const menu = open ? (
    <div
      ref={menuRef}
      className={styles.dropdownMenu}
      style={menuStyle}
      onClick={() => setOpen(false)}
    >
      {children}
    </div>
  ) : null;

  const handleToggle = (e) => {
    e.stopPropagation();
    setOpen((prev) => !prev);
  };

  const triggerEl = isValidElement(trigger)
    ? cloneElement(trigger, { onClick: handleToggle })
    : <span onClick={handleToggle}>{trigger}</span>;

  return (
    <div className={`${styles.dropdownContainer} ${className}`} ref={triggerRef}>
      {triggerEl}
      {typeof document !== 'undefined' && menu
        ? createPortal(menu, document.body)
        : null}
    </div>
  );
}

export function DropdownItem({ children, icon, danger = false, onClick }) {
  return (
    <div
      className={`${styles.dropdownItem} ${danger ? styles.dropdownItemDanger : ''}`}
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
