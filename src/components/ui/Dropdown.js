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
    // Always position via "left", clamped to stay fully on-screen — anchoring
    // via "right: window.innerWidth - rect.right" (the previous approach) can
    // push the menu off-screen when the trigger sits near a narrow viewport's
    // edge, which is common on phones.
    const margin = 8;
    const menuWidth = menuRef.current?.offsetWidth || 200;
    let left = align === 'right' ? rect.right - menuWidth : rect.left;
    left = Math.max(margin, Math.min(left, window.innerWidth - menuWidth - margin));

    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left,
      zIndex: 9999,
      minWidth: 200,
    });
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
