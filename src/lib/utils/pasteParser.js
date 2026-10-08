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

// A paragraph whose entire visible text sits inside a single bold run (e.g.
// someone just bolded a line in Word to act as a heading, instead of using
// a real "Heading" paragraph style) carries no semantic <h*> tag — mammoth
// / browsers render it as <p><strong>...</strong></p>. Block content here
// is plain-text only (see TextBlock.js), so that bold would otherwise be
// silently discarded; promoting it to a heading block is how it survives.
function isWhollyBold(node) {
  let hasText = false;
  let allBold = true;
  const walk = (n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      if (n.textContent.trim()) {
        hasText = true;
        let p = n.parentNode;
        let bold = false;
        while (p && p !== node) {
          if (p.nodeType === Node.ELEMENT_NODE && /^(STRONG|B)$/.test(p.tagName)) { bold = true; break; }
          p = p.parentNode;
        }
        if (!bold) allBold = false;
      }
      return;
    }
    Array.from(n.childNodes || []).forEach(walk);
  };
  walk(node);
  return hasText && allBold;
}

/**
 * Parses a raw HTML string into block descriptors. Shared by clipboard
 * paste and by file-drop import (dropped .html files, and Word docs after
 * mammoth converts them to HTML) so both go through identical structure
 * detection. Returns [] if nothing could be parsed (or outside the browser).
 */
export function parseHtmlToBlocks(html) {
  const blocks = [];
  if (!html || typeof window === 'undefined') return blocks;

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
      } else if (tagName === 'IMG') {
        const src = node.getAttribute('src');
        if (src) blocks.push({ type: 'image', content: { src, caption: node.getAttribute('alt') || '' } });
      } else if (tagName === 'TABLE') {
        const rows = Array.from(node.querySelectorAll('tr')).map((tr) =>
          Array.from(tr.querySelectorAll('td, th')).map((cell) => cell.textContent.trim())
        ).filter((row) => row.length > 0);
        if (rows.length > 0) blocks.push({ type: 'table', content: { rows } });
      } else if (tagName === 'P' || tagName === 'DIV') {
        const txt = node.textContent;
        const trimmed = txt && txt.trim();
        if (trimmed) {
          if (trimmed.length < 90 && isWhollyBold(node)) {
            blocks.push({ type: 'h3', content: { text: trimmed } });
          } else {
            blocks.push(parseLineToBlock(txt, blocks.length === 0));
          }
        }
      } else {
        Array.from(node.childNodes).forEach(processNode);
      }
    };

    Array.from(body.childNodes).forEach(processNode);
  } catch (e) {
    console.error('Failed to parse HTML content:', e);
  }

  return blocks;
}

/**
 * Parses raw plain text into block descriptors, line by line. Shared by
 * clipboard paste and by file-drop import (.txt/.md files, and PDF text
 * extraction) so plain text always gets the same markdown-ish detection
 * (headings, lists, checkboxes, quotes, code fences, dividers).
 */
export function parseTextToBlocks(text) {
  const blocks = [];
  if (!text) return blocks;
  const lines = text.split(/\r?\n/);
  lines.forEach((line) => {
    if (line.trim() !== '') {
      blocks.push(parseLineToBlock(line, blocks.length === 0));
    }
  });
  return blocks;
}

export function parseClipboardToBlocks(clipboardData) {
  const html = clipboardData ? clipboardData.getData('text/html') : '';
  const plainText = clipboardData ? clipboardData.getData('text/plain') : '';

  const htmlBlocks = parseHtmlToBlocks(html);
  if (htmlBlocks.length > 0) return htmlBlocks;

  const textBlocks = parseTextToBlocks(plainText);
  if (textBlocks.length > 0) return textBlocks;

  return [{ type: 'paragraph', content: { text: '' } }];
}
