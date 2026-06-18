'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ChevronRight,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  AlertCircle,
  Copy,
  Link,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image,
  Download,
  Palette,
} from 'lucide-react';
import styles from '@/styles/editor.module.css';

const FRIENDLY_NAMES = {
  paragraph: 'Text',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  h4: 'Heading 4',
  bullet_list: 'Bulleted list',
  numbered_list: 'Numbered list',
  checkbox: 'To-do list',
  quote: 'Quote',
  code: 'Code block',
  callout: 'Callout',
  image: 'Image',
  table: 'Table',
  embed: 'Embed',
  divider: 'Divider',
};

const TEXT_COLORS = [
  { name: 'Default text', value: 'inherit', color: 'var(--color-text-primary)' },
  { name: 'Gray text', value: 'gray', color: 'var(--color-text-muted)' },
  { name: 'Brown text', value: 'brown', color: '#b45309' },
  { name: 'Orange text', value: 'orange', color: '#ea580c' },
  { name: 'Yellow text', value: 'yellow', color: '#eab308' },
  { name: 'Green text', value: 'green', color: '#10b981' },
  { name: 'Blue text', value: 'blue', color: '#3b82f6' },
  { name: 'Purple text', value: 'purple', color: '#8b5cf6' },
  { name: 'Pink text', value: 'pink', color: '#ec4899' },
  { name: 'Red text', value: 'red', color: '#ef4444' },
];

const BG_COLORS = [
  { name: 'Default background', value: 'transparent', color: 'transparent' },
  { name: 'Gray background', value: 'gray_bg', color: 'var(--color-bg-active)' },
  { name: 'Brown background', value: 'brown_bg', color: 'rgba(180, 83, 9, 0.15)' },
  { name: 'Orange background', value: 'orange_bg', color: 'rgba(234, 88, 12, 0.15)' },
  { name: 'Yellow background', value: 'yellow_bg', color: 'rgba(234, 179, 8, 0.15)' },
  { name: 'Green background', value: 'green_bg', color: 'rgba(16, 185, 129, 0.15)' },
  { name: 'Blue background', value: 'blue_bg', color: 'rgba(59, 130, 246, 0.15)' },
  { name: 'Purple background', value: 'purple_bg', color: 'rgba(139, 92, 246, 0.15)' },
  { name: 'Pink background', value: 'pink_bg', color: 'rgba(236, 72, 153, 0.15)' },
  { name: 'Red background', value: 'red_bg', color: 'rgba(239, 68, 68, 0.15)' },
];

const CONVERT_TYPES = [
  { type: 'paragraph', name: 'Text', icon: <Type size={14} /> },
  { type: 'h1', name: 'Heading 1', icon: <Heading1 size={14} /> },
  { type: 'h2', name: 'Heading 2', icon: <Heading2 size={14} /> },
  { type: 'h3', name: 'Heading 3', icon: <Heading3 size={14} /> },
  { type: 'h4', name: 'Heading 4', icon: <Heading4 size={14} /> },
  { type: 'bullet_list', name: 'Bullet list', icon: <List size={14} /> },
  { type: 'numbered_list', name: 'Numbered list', icon: <ListOrdered size={14} /> },
  { type: 'checkbox', name: 'To-do list', icon: <CheckSquare size={14} /> },
  { type: 'quote', name: 'Quote', icon: <Quote size={14} /> },
  { type: 'code', name: 'Code', icon: <Code size={14} /> },
  { type: 'callout', name: 'Callout', icon: <AlertCircle size={14} /> },
];

export default function BlockActionMenu({
  block,
  position,
  onClose,
  onUpdateBlock,
  onDuplicateBlock,
  onDeleteBlock,
}) {
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubmenu, setActiveSubmenu] = useState(null);

  // Click outside to close
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const isImageBlock = block.type === 'image';
  const isEmbedBlock = block.type === 'embed';
  const isTableBlock = block.type === 'table';
  const isDividerBlock = block.type === 'divider';

  const handleTurnInto = (type) => {
    onUpdateBlock(block.id, { type });
    onClose();
  };

  const handleSetTextColor = (colorValue) => {
    onUpdateBlock(block.id, {
      properties: {
        ...(block.properties || {}),
        textColor: colorValue === 'inherit' ? undefined : TEXT_COLORS.find(c => c.value === colorValue)?.color,
      },
    });
    onClose();
  };

  const handleSetBgColor = (colorValue) => {
    onUpdateBlock(block.id, {
      properties: {
        ...(block.properties || {}),
        bgColor: colorValue === 'transparent' ? undefined : BG_COLORS.find(c => c.value === colorValue)?.color,
      },
    });
    onClose();
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/public/${block.pageId || ''}#block-${block.id}`;
    navigator.clipboard.writeText(link);
    onClose();
  };

  const handleDuplicate = () => {
    onDuplicateBlock(block.id);
    onClose();
  };

  const handleDelete = () => {
    onDeleteBlock(block.id);
    onClose();
  };

  // Image actions
  const handleReplaceImage = () => {
    const url = prompt('Paste new image URL:', block.content?.src || '');
    if (url !== null) {
      onUpdateBlock(block.id, { content: { ...block.content, src: url } });
    }
    onClose();
  };

  const handleCopyImageLink = () => {
    if (block.content?.src) {
      navigator.clipboard.writeText(block.content.src);
    }
    onClose();
  };

  const handleDownloadImage = () => {
    if (!block.content?.src) return;
    const link = document.createElement('a');
    link.href = block.content.src;
    link.download = block.content.fileName || 'image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onClose();
  };

  const handleAlign = (alignment) => {
    onUpdateBlock(block.id, {
      properties: {
        ...(block.properties || {}),
        align: alignment,
      },
    });
    onClose();
  };

  // Sections configuration
  const sections = isImageBlock
    ? [
        [
          { id: 'replace', name: 'Replace image', icon: <Image size={14} />, isAction: true, handler: handleReplaceImage },
          { id: 'copy_image', name: 'Copy image link', icon: <Link size={14} />, isAction: true, handler: handleCopyImageLink },
          { id: 'download', name: 'Download image', icon: <Download size={14} />, isAction: true, handler: handleDownloadImage },
          { id: 'align', name: 'Align', icon: <AlignCenter size={14} />, isAction: false, hasSubmenu: 'align' },
        ],
        [
          { id: 'copy_link', name: 'Copy link to block', icon: <Link size={14} />, isAction: true, handler: handleCopyLink },
          { id: 'duplicate', name: 'Duplicate', icon: <Copy size={14} />, isAction: true, handler: handleDuplicate },
          { id: 'delete', name: 'Delete', icon: <Trash2 size={14} />, isAction: true, isDanger: true, handler: handleDelete },
        ],
      ]
    : [
        [
          { id: 'turn_into', name: 'Turn into', icon: <Type size={14} />, isAction: false, hasSubmenu: 'turn_into' },
          { id: 'color', name: 'Color', icon: <Palette size={14} />, isAction: false, hasSubmenu: 'color' },
        ],
        [
          { id: 'copy_link', name: 'Copy link to block', icon: <Link size={14} />, isAction: true, handler: handleCopyLink },
          { id: 'duplicate', name: 'Duplicate', icon: <Copy size={14} />, isAction: true, handler: handleDuplicate },
          { id: 'delete', name: 'Delete', icon: <Trash2 size={14} />, isAction: true, isDanger: true, handler: handleDelete },
        ],
      ];

  // Filtering sections by search query
  const filteredSections = sections
    .map((section) =>
      section.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    )
    .filter((section) => section.length > 0);

  return (
    <div
      ref={containerRef}
      className={styles.gripMenuContainer}
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {/* Main Context Menu */}
      <div className={styles.gripMainMenu} style={{ background: '#020912' }}>
        {/* Search */}
        <input
          ref={searchInputRef}
          type="text"
          className={styles.menuSearchInput}
          placeholder="Search actions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {/* Current block type label */}
        <div className={styles.menuHeader}>
          {FRIENDLY_NAMES[block.type] || 'Block'}
        </div>

        {/* Action Items List */}
        {filteredSections.length === 0 ? (
          <div className={styles.commandMenuEmpty}>No matching actions</div>
        ) : (
          filteredSections.map((section, sIndex) => (
            <div key={sIndex}>
              {sIndex > 0 && <div className={styles.menuDivider} />}
              {section.map((item) => (
                <button
                  key={item.id}
                  className={`${styles.menuItem} ${
                    activeSubmenu === item.hasSubmenu && item.hasSubmenu
                      ? styles.menuItemActive
                      : ''
                  }`}
                  onClick={() => {
                    if (item.isAction) {
                      item.handler();
                    } else if (item.hasSubmenu) {
                      setActiveSubmenu(
                        activeSubmenu === item.hasSubmenu ? null : item.hasSubmenu
                      );
                    }
                  }}
                  onMouseEnter={() => {
                    if (item.hasSubmenu) {
                      setActiveSubmenu(item.hasSubmenu);
                    } else {
                      setActiveSubmenu(null);
                    }
                  }}
                >
                  <span
                    className={styles.menuItemIcon}
                    style={{ color: item.isDanger ? '#ef4444' : undefined }}
                  >
                    {item.icon}
                  </span>
                  <span style={{ color: item.isDanger ? '#ef4444' : undefined }}>
                    {item.name}
                  </span>

                  {item.hasSubmenu && (
                    <span className={styles.menuItemArrow}>
                      <ChevronRight size={12} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Floating Nested Submenu */}
      {activeSubmenu === 'turn_into' && (
        <div className={styles.gripSubMenu} style={{ background: '#020912' }} onMouseLeave={() => setActiveSubmenu(null)}>
          <div className={styles.menuHeader}>Turn into</div>
          {CONVERT_TYPES.map((ct) => (
            <button
              key={ct.type}
              className={styles.menuItem}
              onClick={() => handleTurnInto(ct.type)}
            >
              <span className={styles.menuItemIcon}>{ct.icon}</span>
              {ct.name}
            </button>
          ))}
        </div>
      )}

      {activeSubmenu === 'color' && (
        <div className={styles.gripSubMenu} style={{ background: '#020912' }} onMouseLeave={() => setActiveSubmenu(null)}>
          <div className={styles.menuHeader}>Last used</div>
          <button
            className={styles.menuItem}
            onClick={() => handleSetBgColor('purple_bg')}
          >
            <span
              className={styles.bgColorSquare}
              style={{ background: 'rgba(139, 92, 246, 0.15)' }}
            />
            Purple background
          </button>

          <div className={styles.menuDivider} />

          <div className={styles.menuHeader}>Text color</div>
          {TEXT_COLORS.map((c) => (
            <button
              key={c.name}
              className={styles.menuItem}
              onClick={() => handleSetTextColor(c.value)}
            >
              <span className={styles.textColorA} style={{ color: c.color }}>
                A
              </span>
              {c.name}
              {((!block.properties?.textColor && c.value === 'inherit') ||
                (block.properties?.textColor === c.color)) && (
                <span style={{ marginLeft: 'auto', fontSize: '10px' }}>✓</span>
              )}
            </button>
          ))}

          <div className={styles.menuDivider} />

          <div className={styles.menuHeader}>Background color</div>
          {BG_COLORS.map((c) => (
            <button
              key={c.name}
              className={styles.menuItem}
              onClick={() => handleSetBgColor(c.value)}
            >
              <span className={styles.bgColorSquare} style={{ background: c.color }} />
              {c.name}
              {((!block.properties?.bgColor && c.value === 'transparent') ||
                (block.properties?.bgColor === c.color)) && (
                <span style={{ marginLeft: 'auto', fontSize: '10px' }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}

      {activeSubmenu === 'align' && (
        <div className={styles.gripSubMenu} style={{ background: '#020912' }} onMouseLeave={() => setActiveSubmenu(null)}>
          <div className={styles.menuHeader}>Alignment</div>
          <button className={styles.menuItem} onClick={() => handleAlign('left')}>
            <span className={styles.menuItemIcon}>
              <AlignLeft size={14} />
            </span>
            Left
          </button>
          <button className={styles.menuItem} onClick={() => handleAlign('center')}>
            <span className={styles.menuItemIcon}>
              <AlignCenter size={14} />
            </span>
            Center
          </button>
          <button className={styles.menuItem} onClick={() => handleAlign('right')}>
            <span className={styles.menuItemIcon}>
              <AlignRight size={14} />
            </span>
            Right
          </button>
        </div>
      )}
    </div>
  );
}
