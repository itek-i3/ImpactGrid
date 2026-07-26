/**
 * Smart Paste Parser — Parses pasted HTML / plain text clipboard content into an array of Notion-like block descriptors.
 * Supported block types: h1, h2, h3, h4, paragraph, bullet_list, numbered_list, checkbox, quote, code, divider.
 */

export function parseLineToBlock(text, isFirstLine = false) {
  const t = text.trim();
  if (!t) return { type: 'paragraph', content: { text: '' } };

  // Headings with Markdown # syntax
  if (/^#\s+(.+)/.test(t)) {
    return { type: 'h1', content: { text: t.replace(/^#\s+/, '') } };
  }
  if (/^##\s+(.+)/.test(t)) {
    return { type: 'h2', content: { text: t.replace(/^##\s+/, '') } };
  }
  if (/^###\s+(.+)/.test(t)) {
    return { type: 'h3', content: { text: t.replace(/^###\s+/, '') } };
  }
  if (/^####\s+(.+)/.test(t)) {
    return { type: 'h4', content: { text: t.replace(/^####\s+/, '') } };
  }

  // Section headings with "1. Philosophy", "2. Architecture", etc.
  if (/^\d+\.\s+([A-Z].*)/.test(t) && t.length < 50 && !t.endsWith('.')) {
    return { type: 'h2', content: { text: t } };
  }

  // First line standalone title (e.g. "Obsidian Vault Blueprint — Ephrem's Command Center")
  if (isFirstLine && t.length > 5 && t.length < 80 && !t.endsWith('.')) {
    return { type: 'h1', content: { text: t } };
  }

  // Checkboxes
  if (/^-\s*\[\s*\]\s+(.*)/.test(t)) {
    return { type: 'checkbox', content: { text: t.replace(/^-\s*\[\s*\]\s+/, '') }, properties: { checked: false } };
  }
  if (/^-\s*\[[xX]\]\s+(.*)/.test(t)) {
    return { type: 'checkbox', content: { text: t.replace(/^-\s*\[[xX]\]\s+/, '') }, properties: { checked: true } };
  }

  // Key-value definition lists (e.g. "Projects = things with...", "Areas = ongoing...")
  if (/^([A-Z][a-zA-Z0-9\s]+)\s*=\s*(.*)/.test(t)) {
    return {
      type: 'bullet_list',
      content: { text: t },
    };
  }

  // Bullet list
  if (/^[-*•]\s+(.*)/.test(t)) {
    return { type: 'bullet_list', content: { text: t.replace(/^[-*•]\s+/, '') } };
  }

  // Numbered list
  if (/^\d+[\.\)]\s+(.*)/.test(t)) {
    return { type: 'numbered_list', content: { text: t.replace(/^\d+[\.\)]\s+/, '') } };
  }

  // Quote
  if (/^>\s*(.*)/.test(t)) {
    return { type: 'quote', content: { text: t.replace(/^>\s*/, '') } };
  }

  // Code block
  if (/^```/.test(t)) {
    const codeText = t.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
    return { type: 'code', content: { text: codeText }, properties: { language: 'javascript' } };
  }

  // Divider
  if (/^(---|\*\*\*|___)$/.test(t)) {
    return { type: 'divider', content: {} };
  }

  // Default Paragraph
  return { type: 'paragraph', content: { text } };
}

export function parseClipboardToBlocks(clipboardData) {
  const html = clipboardData ? clipboardData.getData('text/html') : '';
  const plainText = clipboardData ? clipboardData.getData('text/plain') : '';

  let blocks = [];

  if (html && typeof window !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const body = doc.body;

      const processNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const txt = node.textContent;
          if (txt && txt.trim()) {
            blocks.push(parseLineToBlock(txt, blocks.length === 0));
          }
          return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const tagName = node.tagName.toUpperCase();

        if (tagName === 'H1') {
          blocks.push({ type: 'h1', content: { text: node.textContent.trim() } });
        } else if (tagName === 'H2') {
          blocks.push({ type: 'h2', content: { text: node.textContent.trim() } });
        } else if (tagName === 'H3') {
          blocks.push({ type: 'h3', content: { text: node.textContent.trim() } });
        } else if (tagName === 'H4' || tagName === 'H5' || tagName === 'H6') {
          blocks.push({ type: 'h4', content: { text: node.textContent.trim() } });
        } else if (tagName === 'UL') {
          Array.from(node.querySelectorAll(':scope > li')).forEach((li) => {
            const isCheckbox = li.querySelector('input[type="checkbox"]');
            if (isCheckbox) {
              blocks.push({
                type: 'checkbox',
                content: { text: li.textContent.trim() },
                properties: { checked: isCheckbox.checked },
              });
            } else {
              blocks.push({ type: 'bullet_list', content: { text: li.textContent.trim() } });
            }
          });
        } else if (tagName === 'OL') {
          Array.from(node.querySelectorAll(':scope > li')).forEach((li) => {
            blocks.push({ type: 'numbered_list', content: { text: li.textContent.trim() } });
          });
        } else if (tagName === 'BLOCKQUOTE') {
          blocks.push({ type: 'quote', content: { text: node.textContent.trim() } });
        } else if (tagName === 'PRE' || tagName === 'CODE') {
          blocks.push({ type: 'code', content: { text: node.textContent }, properties: { language: 'javascript' } });
        } else if (tagName === 'HR') {
          blocks.push({ type: 'divider', content: {} });
        } else if (tagName === 'P' || tagName === 'DIV') {
          const txt = node.textContent;
          if (txt && txt.trim()) {
            blocks.push(parseLineToBlock(txt, blocks.length === 0));
          }
        } else {
          Array.from(node.childNodes).forEach(processNode);
        }
      };

      Array.from(body.childNodes).forEach(processNode);

      if (blocks.length > 0) return blocks;
    } catch (e) {
      console.error('Failed to parse HTML clipboard data:', e);
    }
  }

  // Fallback to plain text parsing line by line
  if (plainText) {
    const lines = plainText.split(/\r?\n/);
    lines.forEach((line) => {
      if (line.trim() !== '') {
        blocks.push(parseLineToBlock(line, blocks.length === 0));
      }
    });
  }

  return blocks.length > 0 ? blocks : [{ type: 'paragraph', content: { text: '' } }];
}
