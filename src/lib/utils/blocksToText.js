/**
 * Serializes block descriptors back to plain, markdown-ish text — the
 * reverse of pasteParser.js. Used for copying blocks to the system clipboard
 * so they can be pasted into another page, doc, or app as readable text.
 */

const LIST_TYPES = new Set(['bullet_list', 'numbered_list', 'checkbox']);

function blockToLine(block, numberedIndex) {
  const text = (block.content?.text || '').trim();
  switch (block.type) {
    case 'h1': return `# ${text}`;
    case 'h2': return `## ${text}`;
    case 'h3': return `### ${text}`;
    case 'h4': return `#### ${text}`;
    case 'bullet_list': return `- ${text}`;
    case 'numbered_list': return `${numberedIndex}. ${text}`;
    case 'checkbox': return `- [${block.properties?.checked ? 'x' : ' '}] ${text}`;
    case 'quote': return `> ${text}`;
    case 'code': return `\`\`\`${block.properties?.language || ''}\n${block.content?.text || ''}\n\`\`\``;
    case 'divider': return '---';
    case 'callout': return `> ${block.properties?.icon ? `${block.properties.icon} ` : ''}${text}`;
    case 'toggle': return text;
    case 'card': return [block.content?.title, block.content?.description].filter(Boolean).join(' — ');
    case 'paragraph':
    case 'text':
    default: return text;
  }
}

export function blocksToText(blocks) {
  const lines = [];
  let numberedIndex = 0;
  let prevType = null;

  blocks.forEach((block) => {
    numberedIndex = block.type === 'numbered_list' ? numberedIndex + 1 : 0;
    const line = blockToLine(block, numberedIndex);
    if (line === '' && block.type !== 'divider') return;

    const sameListRun = LIST_TYPES.has(block.type) && block.type === prevType;
    if (lines.length > 0 && !sameListRun) lines.push('');
    lines.push(line);
    prevType = block.type;
  });

  return lines.join('\n');
}
