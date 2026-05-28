'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Image,
  AlertCircle,
  Code,
  ChevronRight,
  CheckSquare,
  Minus,
  Table,
  Link,
  Quote,
  List,
  ListOrdered,
} from 'lucide-react';
import styles from '@/styles/editor.module.css';

/**
 * Block type definitions for the slash command menu.
 */
const BLOCK_TYPES = [
  {
    category: 'Basic',
    items: [
      { type: 'paragraph', name: 'Text', desc: 'Plain text block', icon: <Type size={18} /> },
      { type: 'h1', name: 'Heading 1', desc: 'Large section heading', icon: <Heading1 size={18} /> },
      { type: 'h2', name: 'Heading 2', desc: 'Medium section heading', icon: <Heading2 size={18} /> },
      { type: 'h3', name: 'Heading 3', desc: 'Small section heading', icon: <Heading3 size={18} /> },
      { type: 'h4', name: 'Heading 4', desc: 'Tiny section heading', icon: <Heading4 size={18} /> },
      { type: 'bullet_list', name: 'Bullet list', desc: 'Unordered list item', icon: <List size={18} /> },
      { type: 'numbered_list', name: 'Numbered list', desc: 'Ordered list item', icon: <ListOrdered size={18} /> },
      { type: 'checkbox', name: 'To-do', desc: 'Checkbox task item', icon: <CheckSquare size={18} /> },
    ],
  },
  {
    category: 'Media',
    items: [
      { type: 'image', name: 'Image', desc: 'Upload or embed an image', icon: <Image size={18} /> },
      { type: 'embed', name: 'Embed', desc: 'YouTube, Vimeo, Figma, Maps', icon: <Link size={18} /> },
    ],
  },
  {
    category: 'Advanced',
    items: [
      { type: 'callout', name: 'Callout', desc: 'Highlighted information block', icon: <AlertCircle size={18} /> },
      { type: 'code', name: 'Code', desc: 'Code block with syntax', icon: <Code size={18} /> },
      { type: 'toggle', name: 'Toggle', desc: 'Collapsible content section', icon: <ChevronRight size={18} /> },
      { type: 'quote', name: 'Quote', desc: 'Blockquote text', icon: <Quote size={18} /> },
      { type: 'divider', name: 'Divider', desc: 'Visual separator line', icon: <Minus size={18} /> },
      { type: 'table', name: 'Table', desc: 'Simple table with rows/columns', icon: <Table size={18} /> },
    ],
  },
];

/**
 * BlockMenu — slash command palette for inserting block types.
 * Shows on typing '/' in an empty block.
 */
export default function BlockMenu({ position, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  // Filter items by query
  const filteredCategories = BLOCK_TYPES.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (item) =>
        item.name.toLowerCase().includes(query.toLowerCase()) ||
        item.desc.toLowerCase().includes(query.toLowerCase()) ||
        item.type.toLowerCase().includes(query.toLowerCase())
    ),
  })).filter((cat) => cat.items.length > 0);

  const allItems = filteredCategories.flatMap((cat) => cat.items);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, allItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (allItems[activeIndex]) {
          onSelect(allItems[activeIndex].type);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, allItems, onSelect, onClose]);

  // Reset active index on query change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Click outside to close
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Auto-focus search
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  let itemIndex = 0;

  return (
    <div
      ref={menuRef}
      className={styles.commandMenu}
      style={{
        top: position?.top || 0,
        left: position?.left || 0,
      }}
    >
      {/* Search input */}
      <div style={{ padding: '4px 8px 8px' }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Filter blocks..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 10px',
            fontSize: 'var(--text-sm)',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-primary)',
            outline: 'none',
          }}
        />
      </div>

      {filteredCategories.length === 0 ? (
        <div className={styles.commandMenuEmpty}>
          No blocks matching &ldquo;{query}&rdquo;
        </div>
      ) : (
        filteredCategories.map((category) => (
          <div key={category.category}>
            <div className={styles.commandMenuHeader}>
              {category.category}
            </div>
            {category.items.map((item) => {
              const currentIndex = itemIndex++;
              return (
                <div
                  key={item.type}
                  className={`${styles.commandMenuItem} ${
                    currentIndex === activeIndex
                      ? styles.commandMenuItemActive
                      : ''
                  }`}
                  onClick={() => onSelect(item.type)}
                  onMouseEnter={() => setActiveIndex(currentIndex)}
                >
                  <div className={styles.commandMenuItemIcon}>
                    {item.icon}
                  </div>
                  <div className={styles.commandMenuItemInfo}>
                    <div className={styles.commandMenuItemName}>
                      {item.name}
                    </div>
                    <div className={styles.commandMenuItemDesc}>
                      {item.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

// Export block types for reuse
export { BLOCK_TYPES };
