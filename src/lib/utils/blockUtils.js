/**
 * Block utility functions for the ImpactNotion editor.
 * Helpers for block creation, transformation, serialization, and manipulation.
 */

/**
 * Create a new block with sensible defaults for the given type.
 * @param {string} type - Block type (paragraph, h1, image, etc.)
 * @param {object} overrides - Optional property overrides.
 * @returns {object} A fully formed block object.
 */
export function createBlock(type = 'paragraph', overrides = {}) {
  const defaults = getBlockDefaults(type);
  return {
    id: crypto.randomUUID(),
    type,
    content: defaults.content,
    properties: defaults.properties,
    parentBlockId: null,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Get default content and properties for a block type.
 */
export function getBlockDefaults(type) {
  switch (type) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
      return { content: { text: '' }, properties: {} };

    case 'callout':
      return {
        content: { text: '' },
        properties: { color: 'blue', icon: '💡' },
      };

    case 'code':
      return {
        content: { text: '' },
        properties: { language: 'javascript' },
      };

    case 'toggle':
      return {
        content: { text: '' },
        properties: { open: false },
      };

    case 'checkbox':
      return {
        content: { text: '' },
        properties: { checked: false },
      };

    case 'divider':
      return { content: {}, properties: {} };

    case 'image':
      return {
        content: { url: '', caption: '' },
        properties: { width: '100%' },
      };

    case 'table':
      return {
        content: {
          rows: [
            ['Header 1', 'Header 2', 'Header 3'],
            ['', '', ''],
            ['', '', ''],
          ],
        },
        properties: {},
      };

    case 'embed':
      return {
        content: { url: '' },
        properties: {},
      };

    case 'quote':
      return {
        content: { text: '' },
        properties: {},
      };

    case 'bullet_list':
    case 'numbered_list':
      return {
        content: { text: '' },
        properties: { listType: type === 'bullet_list' ? 'bullet' : 'numbered' },
      };

    default: // paragraph
      return { content: { text: '' }, properties: {} };
  }
}

/**
 * Get a human-readable label for a block type.
 */
export function getBlockLabel(type) {
  const labels = {
    paragraph: 'Text',
    h1: 'Heading 1',
    h2: 'Heading 2',
    h3: 'Heading 3',
    h4: 'Heading 4',
    callout: 'Callout',
    code: 'Code',
    toggle: 'Toggle',
    checkbox: 'To-do',
    divider: 'Divider',
    image: 'Image',
    table: 'Table',
    embed: 'Embed',
    quote: 'Quote',
    bullet_list: 'Bulleted List',
    numbered_list: 'Numbered List',
    list: 'List',
  };
  return labels[type] || type;
}

/**
 * Check if a block type supports text editing (contenteditable).
 */
export function isTextBlock(type) {
  return [
    'paragraph',
    'h1', 'h2', 'h3', 'h4',
    'callout',
    'checkbox',
    'toggle',
    'quote',
    'bullet_list',
    'numbered_list',
    'list',
  ].includes(type);
}

/**
 * Check if a block type is a heading.
 */
export function isHeadingBlock(type) {
  return ['h1', 'h2', 'h3', 'h4'].includes(type);
}

/**
 * Check if a block type is a list item.
 */
export function isListBlock(type) {
  return ['bullet_list', 'numbered_list', 'checkbox', 'list'].includes(type);
}

/**
 * Extract plain text from a block's content (for search/filtering).
 */
export function getBlockPlainText(block) {
  if (!block?.content) return '';
  if (typeof block.content.text === 'string') return block.content.text;
  if (typeof block.content === 'string') return block.content;
  return '';
}

/**
 * Reorder an array of blocks by moving an item from one index to another.
 * Returns a new array with updated sortOrder values.
 */
export function reorderBlocks(blocks, fromIndex, toIndex) {
  const result = [...blocks];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result.map((block, i) => ({ ...block, sortOrder: i }));
}

/**
 * Flatten nested blocks into a flat ordered array.
 * Useful for rendering or exporting.
 */
export function flattenBlocks(blocks, parentId = null) {
  const children = blocks
    .filter((b) => b.parentBlockId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const result = [];
  for (const child of children) {
    result.push(child);
    result.push(...flattenBlocks(blocks, child.id));
  }
  return result;
}
