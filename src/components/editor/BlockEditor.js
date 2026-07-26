'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, GripVertical, Trash2, Copy, X } from 'lucide-react';
import { useEditorStore } from '@/lib/store/useEditorStore';
import { parseClipboardToBlocks } from '@/lib/utils/pasteParser';
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
import CardBlock from './blocks/CardBlock';

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
  card: CardBlock,
};

/**
 * BlockEditor — Notion-like block editor component.
 * Renders an array of blocks with rich editing, drag-and-drop reordering,
 * multi-block selection checkboxes, slash command menu, and floating format toolbar.
 */
export default function BlockEditor({ pageId, parentBlockId = null, readOnly = false }) {
  const {
    blocks: allBlocks,
    activeBlockId,
    addBlock,
    addBlocks,
    moveBlock,
    updateBlock,
    deleteBlock,
    deleteSelectedBlocks,
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

  // Drag and Drop reorder state
  const [dropTarget, setDropTarget] = useState({ id: null, position: null });

  // Multi-block checkbox selection state
  const [selectedBlockIds, setSelectedBlockIds] = useState(new Set());

  const editorRef = useRef(null);

  const toggleSelectBlock = useCallback((blockId) => {
    setSelectedBlockIds((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedBlockIds.size === blocks.length && blocks.length > 0) {
      setSelectedBlockIds(new Set());
    } else {
      setSelectedBlockIds(new Set(blocks.map((b) => b.id)));
    }
  }, [blocks, selectedBlockIds.size]);

  const handleDeleteSelected = useCallback(async () => {
    const ids = Array.from(selectedBlockIds);
    if (ids.length === 0) return;
    await deleteSelectedBlocks(ids);
    setSelectedBlockIds(new Set());
  }, [selectedBlockIds, deleteSelectedBlocks]);

  const handleDuplicateSelected = useCallback(() => {
    const ids = Array.from(selectedBlockIds);
    ids.forEach((id) => duplicateBlock(id));
    setSelectedBlockIds(new Set());
  }, [selectedBlockIds, duplicateBlock]);

  const handleGripClick = useCallback((e, block) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setActionMenuBlock(block);
    setActionMenuPosition({ top: rect.bottom + 4, left: rect.left });
    setActionMenuOpen(true);
  }, []);

  // ── Drag & Drop Handlers ──

  const handleDragStart = useCallback((e, blockId) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', blockId);
    const blockEl = document.getElementById(`block-${blockId}`);
    if (blockEl) {
      setTimeout(() => {
        blockEl.style.opacity = '0.4';
      }, 0);
    }
  }, []);

  const handleDragEnd = useCallback((e, blockId) => {
    const blockEl = document.getElementById(`block-${blockId}`);
    if (blockEl) {
      blockEl.style.opacity = '1';
    }
    setDropTarget({ id: null, position: null });
  }, []);

  const handleDragOver = useCallback((e, blockId) => {
    if (readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const targetEl = document.getElementById(`block-${blockId}`);
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const position = e.clientY < midY ? 'top' : 'bottom';
      setDropTarget({ id: blockId, position });
    }
  }, [readOnly]);

  const handleDragLeave = useCallback((e, blockId) => {
    setDropTarget((prev) => (prev.id === blockId ? { id: null, position: null } : prev));
  }, []);

  const handleDrop = useCallback(
    (e, targetBlockId) => {
      if (readOnly) return;
      e.preventDefault();
      const draggedBlockId = e.dataTransfer.getData('text/plain');
      setDropTarget({ id: null, position: null });

      const draggedEl = document.getElementById(`block-${draggedBlockId}`);
      if (draggedEl) {
        draggedEl.style.opacity = '1';
      }

      if (draggedBlockId && draggedBlockId !== targetBlockId && moveBlock) {
        const targetEl = document.getElementById(`block-${targetBlockId}`);
        let targetPos = 'after';
        if (targetEl) {
          const rect = targetEl.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          targetPos = e.clientY < midY ? 'before' : 'after';
        }
        moveBlock(draggedBlockId, targetBlockId, targetPos);
      }
    },
    [readOnly, moveBlock]
  );

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
        } else if (type === 'card') {
          updateBlock(menuTargetBlockId, {
            content: { icon: '🌐', title: '', description: '', fullContent: '', accent: '#306CEC' },
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

    let isMouseDown = false;

    function checkAndShowToolbar() {
      if (isMouseDown) return;

      const selection = window.getSelection();
      if (
        selection &&
        !selection.isCollapsed &&
        selection.rangeCount > 0 &&
        editorRef.current?.contains(selection.anchorNode)
      ) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          setToolbarPosition(null);
          return;
        }

        const top = rect.top - 46 < 10 ? rect.bottom + 8 : rect.top - 46;
        const left = rect.left + rect.width / 2;
        setToolbarPosition({ top, left });
      } else {
        setToolbarPosition(null);
      }
    }

    function handleMouseDown(e) {
      isMouseDown = true;
      setToolbarPosition(null);
    }

    function handleMouseUp() {
      isMouseDown = false;
      setTimeout(checkAndShowToolbar, 20);
    }

    function handleKeyUp() {
      checkAndShowToolbar();
    }

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [readOnly]);

  // ── Block Event Handlers ──

  const handleBlockUpdate = useCallback(
    (blockId, updates) => {
      if (readOnly) return;
      updateBlock(blockId, updates);
    },
    [updateBlock, readOnly]
  );

  const handleBlockPaste = useCallback(
    async (e, targetBlockId) => {
      if (readOnly) return;
      const parsedBlocks = parseClipboardToBlocks(e.clipboardData);
      if (!parsedBlocks || parsedBlocks.length === 0) return;

      // If pasting multi-line or distinct block types:
      if (parsedBlocks.length > 1 || parsedBlocks[0].type !== 'paragraph') {
        e.preventDefault();

        const targetBlock = blocks.find((b) => b.id === targetBlockId);
        const isTargetEmpty = !targetBlock?.content?.text || targetBlock.content.text.trim() === '';

        if (isTargetEmpty) {
          // Replace empty target block with first item
          changeBlockType(targetBlockId, parsedBlocks[0].type);
          updateBlock(targetBlockId, {
            content: parsedBlocks[0].content,
            properties: parsedBlocks[0].properties || {},
          });

          if (parsedBlocks.length > 1) {
            const added = await addBlocks(parsedBlocks.slice(1), targetBlockId);
            if (added.length > 0) {
              setFocusBlockId(added[added.length - 1].id);
            }
          } else {
            setFocusBlockId(targetBlockId);
          }
        } else {
          // Append all parsed blocks after non-empty target block
          const added = await addBlocks(parsedBlocks, targetBlockId);
          if (added.length > 0) {
            setFocusBlockId(added[added.length - 1].id);
          }
        }
      }
    },
    [readOnly, blocks, changeBlockType, updateBlock, addBlocks]
  );

  const handleBlockKeyDown = useCallback(
    (e, blockId, index) => {
      if (readOnly) return;
      const block = blocks.find((b) => b.id === blockId);

      // Enter behaviour:
      //  • plain Enter in a normal text block → soft line break (stay in the block)
      //  • plain Enter in a list / checkbox   → next list item (unchanged)
      //  • Shift+Enter                        → start a NEW block below
      if (e.key === 'Enter') {
        // Code / table / card blocks handle Enter themselves
        if (block?.type === 'code' || block?.type === 'table' || block?.type === 'card') return;

        const isListLike =
          block?.type === 'bullet_list' || block?.type === 'numbered_list' || block?.type === 'checkbox';

        // Normal text block, plain Enter → line break within the same block
        if (!e.shiftKey && !isListLike) {
          e.preventDefault();
          document.execCommand('insertLineBreak');
          return;
        }

        // Otherwise start a new block below (next list item, or a new paragraph on Shift+Enter)
        e.preventDefault();
        const newBlockId = crypto.randomUUID();
        const newType = isListLike ? block.type : 'paragraph';
        addBlock({ id: newBlockId, type: newType, content: { text: '' } }, blockId);
        setFocusBlockId(newBlockId);
        return;
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
          block?.type !== 'embed' &&
          block?.type !== 'card'
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
        handleSlashCommand(blockId, { top: rect.bottom + 4, left: rect.left });
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
      {/* Top Batch Selection Toolbar */}
      {!readOnly && blocks.length > 0 && (
        <div className={styles.batchToolbar}>
          <div className={styles.batchToolbarLeft}>
            <input
              type="checkbox"
              className={styles.blockSelectCheckbox}
              checked={selectedBlockIds.size > 0 && selectedBlockIds.size === blocks.length}
              onChange={toggleSelectAll}
              title="Select all blocks"
            />
            <span>
              {selectedBlockIds.size > 0
                ? `${selectedBlockIds.size} of ${blocks.length} selected`
                : 'Select all'}
            </span>
          </div>

          {selectedBlockIds.size > 0 && (
            <div className={styles.batchToolbarRight}>
              <button
                className={`${styles.batchActionBtn} ${styles.batchDeleteBtn}`}
                onClick={handleDeleteSelected}
                title="Delete selected blocks"
              >
                <Trash2 size={14} />
                Delete ({selectedBlockIds.size})
              </button>
              <button
                className={styles.batchActionBtn}
                onClick={handleDuplicateSelected}
                title="Duplicate selected blocks"
              >
                <Copy size={14} />
                Duplicate
              </button>
              <button
                className={styles.batchActionBtn}
                onClick={() => setSelectedBlockIds(new Set())}
                title="Deselect all"
              >
                <X size={14} />
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {blocks.map((block, index) => {
        const BlockComponent = BLOCK_COMPONENTS[block.type];
        if (!BlockComponent) return null;

        const isAutoFocus = focusBlockId === block.id;
        const listIndex = block.type === 'numbered_list' ? getListIndex(block.id, index) : 0;
        const isChecked = selectedBlockIds.has(block.id);

        return (
          <div
            key={block.id}
            className={`${styles.blockWrapper} ${parentBlockId ? styles.blockWrapperNested : ''} ${
              isChecked ? styles.blockWrapperChecked : ''
            } ${
              dropTarget.id === block.id && dropTarget.position === 'top' ? styles.dropIndicatorTop || '' : ''
            } ${
              dropTarget.id === block.id && dropTarget.position === 'bottom' ? styles.dropIndicatorBottom || '' : ''
            }`}
            onClick={(e) => {
              if (!readOnly) {
                e.stopPropagation();
                setActiveBlock(block.id);
              }
            }}
            onDragOver={(e) => handleDragOver(e, block.id)}
            onDragLeave={(e) => handleDragLeave(e, block.id)}
            onDrop={(e) => handleDrop(e, block.id)}
            id={`block-${block.id}`}
          >
            {/* Block Controls */}
            {!readOnly && (
              <div className={styles.blockControls}>
                <input
                  type="checkbox"
                  className={styles.blockSelectCheckbox}
                  checked={isChecked}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleSelectBlock(block.id);
                  }}
                  title="Select block"
                />
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
                  title="Drag to reorder / Click for actions"
                  onClick={(e) => handleGripClick(e, block)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, block.id)}
                  onDragEnd={(e) => handleDragEnd(e, block.id)}
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
                listIndex={listIndex}
                autoFocus={isAutoFocus && !readOnly}
                onUpdate={(updates) => !readOnly && handleBlockUpdate(block.id, updates)}
                onKeyDown={(e) => !readOnly && handleBlockKeyDown(e, block.id, index)}
                onInput={(e) => !readOnly && handleBlockInput(block.id, e)}
                onPaste={(e) => !readOnly && handleBlockPaste(e, block.id)}
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
