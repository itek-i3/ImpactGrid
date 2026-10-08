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

    // Open toward whichever side of the trigger has more room — a trigger
    // near the bottom of a scrollable list (e.g. a sidebar page item just
    // above the fixed footer nav) would otherwise always open downward and
    // sit on top of whatever's below it even when there's more room above.
    const menuHeight = menuRef.current?.offsetHeight || 0;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = menuHeight > 0 && spaceBelow < menuHeight + margin && spaceAbove > spaceBelow;
    let top = openUpward ? rect.top - menuHeight - 4 : rect.bottom + 4;
    // Final safety clamp so the menu itself is never cut off by the viewport
    // on a short screen, even when neither side has full room for it.
    top = Math.max(margin, Math.min(top, window.innerHeight - menuHeight - margin));

    setMenuStyle({
      position: 'fixed',
      top,
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

  // A dim backdrop behind the menu — when the trigger is tight on space in
  // both directions the menu still has to sit on top of something, and
  // without this a covered row just looks broken instead of intentionally
  // layered underneath an open menu.
  const menu = open ? (
    <>
      <div className={styles.dropdownBackdrop} style={{ zIndex: 9998 }} onClick={() => setOpen(false)} />
      <div
        ref={menuRef}
        className={styles.dropdownMenu}
        style={menuStyle}
        onClick={() => setOpen(false)}
      >
        {children}
      </div>
    </>
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
