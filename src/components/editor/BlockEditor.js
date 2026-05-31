'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, GripVertical } from 'lucide-react';
import { useEditorStore } from '@/lib/store/useEditorStore';
import BlockMenu from './BlockMenu';
import BlockToolbar from './BlockToolbar';
import BlockActionMenu from './BlockActionMenu';

// Block type components
import TextBlock from './blocks/TextBlock';
import HeadingBlock from './blocks/HeadingBlock';
import CalloutBlock from './blocks/CalloutBlock';
import CodeBlock from './blocks/CodeBlock';
import ToggleBlock from './blocks/ToggleBlock';
import CheckboxBlock from './blocks/CheckboxBlock';
import DividerBlock from './blocks/DividerBlock';
import ImageBlock from './blocks/ImageBlock';
import TableBlock from './blocks/TableBlock';
import EmbedBlock from './blocks/EmbedBlock';
import QuoteBlock from './blocks/QuoteBlock';
import { BulletListBlock, NumberedListBlock } from './blocks/ListBlock';
import ColumnsBlock from './blocks/ColumnsBlock';
import ColumnBlock from './blocks/ColumnBlock';

import styles from '@/styles/editor.module.css';

/**
 * Map block types to their components.
 */
const BLOCK_COMPONENTS = {
  paragraph: TextBlock,
  h1: HeadingBlock,
  h2: HeadingBlock,
  h3: HeadingBlock,
  h4: HeadingBlock,
  callout: CalloutBlock,
  code: CodeBlock,
  toggle: ToggleBlock,
  checkbox: CheckboxBlock,
  divider: DividerBlock,
  image: ImageBlock,
  table: TableBlock,
  embed: EmbedBlock,
  quote: QuoteBlock,
  bullet_list: BulletListBlock,
  numbered_list: NumberedListBlock,
  columns: ColumnsBlock,
  column: ColumnBlock,
};

/**
 * BlockEditor — the main editor container.
 * Renders ordered blocks, handles creation/deletion/reordering,
 * slash command menu, and floating format toolbar.
 */
export default function BlockEditor({ pageId, parentBlockId = null, readOnly = false }) {
  const {
    blocks: allBlocks,
    activeBlockId,
    addBlock,
    updateBlock,
    deleteBlock,
    duplicateBlock,
    changeBlockType,
    setActiveBlock,
  } = useEditorStore();

  const blocks = allBlocks.filter((b) => b.parentBlockId === parentBlockId);

  // Slash command menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const [menuTargetBlockId, setMenuTargetBlockId] = useState(null);

  // Block actions context menu state
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [actionMenuPosition, setActionMenuPosition] = useState(null);
  const [actionMenuBlock, setActionMenuBlock] = useState(null);

  // Floating toolbar state
  const [toolbarPosition, setToolbarPosition] = useState(null);

  // Track which block needs auto-focus
  const [focusBlockId, setFocusBlockId] = useState(null);

  const editorRef = useRef(null);

  const handleGripClick = useCallback((e, block) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const editorRect = editorRef.current?.getBoundingClientRect();
    // Position relative to the editor container
    const top = rect.bottom - (editorRect?.top || 0) + 4;
    const left = rect.left - (editorRect?.left || 0);
    setActionMenuBlock(block);
    setActionMenuPosition({ top, left });
    setActionMenuOpen(true);
  }, []);

  // ── Slash Command Handling ──

  const handleSlashCommand = useCallback(
    (blockId, position) => {
      if (readOnly) return;
      setMenuTargetBlockId(blockId);
      setMenuPosition(position);
      setMenuOpen(true);
    },
    [readOnly]
  );

  const handleMenuSelect = useCallback(
    (type) => {
      if (readOnly) return;
      if (menuTargetBlockId) {
        const finalType = (type === 'columns_2' || type === 'columns_3') ? 'columns' : type;

        // Change the existing block's type
        changeBlockType(menuTargetBlockId, finalType);

        // Clear the '/' text from the block content
        updateBlock(menuTargetBlockId, {
          content: { text: '' },
        });

        // Set defaults for specific block types
        if (type === 'table') {
          updateBlock(menuTargetBlockId, {
            content: {
              rows: [
                ['Header 1', 'Header 2', 'Header 3'],
                ['', '', ''],
                ['', '', ''],
              ],
            },
          });
        } else if (type === 'callout') {
          updateBlock(menuTargetBlockId, {
            properties: { color: 'blue', icon: '💡' },
          });
        } else if (type === 'code') {
          updateBlock(menuTargetBlockId, {
            properties: { language: 'javascript' },
            content: { text: '' },
          });
        } else if (type === 'columns_2' || type === 'columns_3') {
          const colsCount = type === 'columns_2' ? 2 : 3;
          updateBlock(menuTargetBlockId, {
            properties: { colsCount },
          });

          // Create the column blocks and their child paragraphs
          for (let i = 0; i < colsCount; i++) {
            const colId = crypto.randomUUID();
            const width = `${100 / colsCount}%`;
            addBlock({
              id: colId,
              type: 'column',
              parentBlockId: menuTargetBlockId,
              properties: { width },
            });

            const pId = crypto.randomUUID();
            addBlock({
              id: pId,
              type: 'paragraph',
              parentBlockId: colId,
              content: { text: '' },
            });

            if (i === 0) {
              setFocusBlockId(pId);
            }
          }
        }

        if (type !== 'columns_2' && type !== 'columns_3') {
          setFocusBlockId(menuTargetBlockId);
        }
      }
      setMenuOpen(false);
      setMenuTargetBlockId(null);
    },
    [menuTargetBlockId, changeBlockType, updateBlock, addBlock, readOnly]
  );

  const handleMenuClose = useCallback(() => {
    setMenuOpen(false);
    setMenuTargetBlockId(null);
  }, []);

  // ── Floating Toolbar ──

  useEffect(() => {
    if (readOnly) return;
    function handleSelectionChange() {
      const selection = window.getSelection();
      if (
        selection &&
        !selection.isCollapsed &&
        selection.rangeCount > 0 &&
        editorRef.current?.contains(selection.anchorNode)
      ) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setToolbarPosition({
          top: rect.top + window.scrollY,
          left: rect.left + rect.width / 2 - 120,
        });
      } else {
        setToolbarPosition(null);
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange);
    return () =>
      document.removeEventListener('selectionchange', handleSelectionChange);
  }, [readOnly]);

  // ── Block Event Handlers ──

  const handleBlockUpdate = useCallback(
    (blockId, updates) => {
      if (readOnly) return;
      updateBlock(blockId, updates);
    },
    [updateBlock, readOnly]
  );

  const handleBlockKeyDown = useCallback(
    (e, blockId, index) => {
      if (readOnly) return;
      const block = blocks.find((b) => b.id === blockId);

      // Enter creates a new block below
      if (e.key === 'Enter' && !e.shiftKey) {
        // Don't intercept Enter in code blocks or toggles
        if (block?.type === 'code' || block?.type === 'table') return;

        e.preventDefault();
        const newBlockId = crypto.randomUUID();

        // If the current block is a list item, create another of the same type
        const newType =
          block?.type === 'bullet_list' || block?.type === 'numbered_list' || block?.type === 'checkbox'
            ? block.type
            : 'paragraph';

        addBlock(
          {
            id: newBlockId,
            type: newType,
            content: { text: '' },
          },
          blockId
        );
        setFocusBlockId(newBlockId);
      }

      // Backspace on empty block: delete it and focus previous
      if (e.key === 'Backspace') {
        const text = block?.content?.text || '';
        const innerText = e.target?.innerText || '';

        if (
          (text === '' || text === '/') &&
          innerText.trim() === '' &&
          blocks.length > 1
        ) {
          e.preventDefault();
          const prevBlock = blocks[index - 1];
          deleteBlock(blockId);
          if (prevBlock) {
            setFocusBlockId(prevBlock.id);
          }
        }

        // If block is not paragraph and text is empty, convert to paragraph
        if (
          innerText.trim() === '' &&
          block?.type !== 'paragraph' &&
          block?.type !== 'divider' &&
          block?.type !== 'image' &&
          block?.type !== 'table' &&
          block?.type !== 'embed'
        ) {
          e.preventDefault();
          changeBlockType(blockId, 'paragraph');
          setFocusBlockId(blockId);
        }
      }

      // Tab to indent (future: nesting)
      if (e.key === 'Tab') {
        e.preventDefault();
        // For code blocks, insert actual tab
        if (block?.type === 'code') {
          document.execCommand('insertText', false, '  ');
        }
      }

      // Arrow up: focus previous block
      if (e.key === 'ArrowUp' && index > 0) {
        const selection = window.getSelection();
        if (selection && selection.anchorOffset === 0) {
          e.preventDefault();
          setFocusBlockId(blocks[index - 1].id);
        }
      }

      // Arrow down: focus next block
      if (e.key === 'ArrowDown' && index < blocks.length - 1) {
        const selection = window.getSelection();
        const node = selection?.anchorNode;
        if (node) {
          const text = node.textContent || '';
          if (selection.anchorOffset >= text.length) {
            e.preventDefault();
            setFocusBlockId(blocks[index + 1].id);
          }
        }
      }
    },
    [blocks, addBlock, deleteBlock, changeBlockType, readOnly]
  );

  // ── Slash detection in block input ──

  const handleBlockInput = useCallback(
    (blockId, e) => {
      if (readOnly) return;
      const text = e?.target?.innerText || '';

      // Detect '/' at the start of a block
      if (text === '/') {
        const rect = e.target.getBoundingClientRect();
        const editorRect = editorRef.current?.getBoundingClientRect();
        // Position relative to the editor container
        const top = rect.bottom - (editorRect?.top || 0) + 4;
        const left = rect.left - (editorRect?.left || 0);
        handleSlashCommand(blockId, { top, left });
      }
    },
    [handleSlashCommand, readOnly]
  );

  // ── Add Block Button ──

  const handleAddBlock = useCallback(
    (afterBlockId = null) => {
      if (readOnly) return;
      const newBlockId = crypto.randomUUID();
      addBlock(
        { id: newBlockId, type: 'paragraph', content: { text: '' }, parentBlockId },
        afterBlockId
      );
      setFocusBlockId(newBlockId);
    },
    [addBlock, readOnly, parentBlockId]
  );

  // ── Compute numbered list index ──
  const getListIndex = useCallback(
    (blockId, index) => {
      let count = 0;
      for (let i = 0; i <= index; i++) {
        if (blocks[i].type === 'numbered_list') {
          if (blocks[i].id === blockId) return count;
          count++;
        } else {
          count = 0;
        }
      }
      return 0;
    },
    [blocks]
  );

  return (
    <div className={`${styles.editor} ${readOnly ? styles.readOnlyEditor : ''}`} ref={editorRef}>
      {blocks.map((block, index) => {
        const BlockComponent = BLOCK_COMPONENTS[block.type];
        if (!BlockComponent) return null;

        const isAutoFocus = focusBlockId === block.id;

        return (
          <div
            key={block.id}
            className={`${styles.blockWrapper} ${parentBlockId ? styles.blockWrapperNested : ''}`}
            onClick={(e) => {
              if (!readOnly) {
                e.stopPropagation();
                setActiveBlock(block.id);
              }
            }}
            id={`block-${block.id}`}
          >
            {/* Block Controls */}
            {!readOnly && (
              <div className={styles.blockControls}>
                <button
                  className={styles.blockControlBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddBlock(block.id);
                  }}
                  title="Add block below"
                >
                  <Plus size={14} />
                </button>
                <button
                  className={`${styles.blockControlBtn} ${styles.dragHandle}`}
                  title="Block actions"
                  onClick={(e) => handleGripClick(e, block)}
                >
                  <GripVertical size={14} />
                </button>
              </div>
            )}

            {/* Block Component Container with Dynamic Styling */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                color: block.properties?.textColor || undefined,
                background: block.properties?.bgColor || undefined,
                padding: block.properties?.bgColor ? 'var(--space-1) var(--space-3)' : undefined,
                borderRadius: block.properties?.bgColor ? 'var(--radius-md)' : undefined,
                textAlign: block.properties?.align || undefined,
              }}
            >
              <BlockComponent
                block={block}
                index={index}
                autoFocus={isAutoFocus && !readOnly}
                onUpdate={(updates) => !readOnly && handleBlockUpdate(block.id, updates)}
                onKeyDown={(e) => !readOnly && handleBlockKeyDown(e, block.id, index)}
                onInput={(e) => !readOnly && handleBlockInput(block.id, e)}
                readOnly={readOnly}
              />
            </div>
          </div>
        );
      })}

      {/* Empty state click area */}
      {!readOnly && (
        <div
          style={{ minHeight: parentBlockId ? '50px' : '30vh', cursor: 'text' }}
          onClick={(e) => {
            e.stopPropagation();
            if (blocks.length === 0) {
              handleAddBlock();
            } else {
              // Focus last block
              setFocusBlockId(blocks[blocks.length - 1].id);
            }
          }}
        />
      )}

      {/* Slash Command Menu */}
      {!readOnly && menuOpen && menuPosition && (
        <BlockMenu
          position={menuPosition}
          isNested={parentBlockId !== null}
          onSelect={handleMenuSelect}
          onClose={handleMenuClose}
        />
      )}

      {/* Floating Format Toolbar */}
      {!readOnly && toolbarPosition && (
        <BlockToolbar
          position={toolbarPosition}
          onClose={() => setToolbarPosition(null)}
        />
      )}

      {/* Block Action Context Menu */}
      {!readOnly && actionMenuOpen && actionMenuPosition && actionMenuBlock && (
        <BlockActionMenu
          block={actionMenuBlock}
          position={actionMenuPosition}
          onClose={() => {
            setActionMenuOpen(false);
            setActionMenuBlock(null);
          }}
          onUpdateBlock={updateBlock}
          onDuplicateBlock={duplicateBlock}
          onDeleteBlock={deleteBlock}
        />
      )}
    </div>
  );
}
