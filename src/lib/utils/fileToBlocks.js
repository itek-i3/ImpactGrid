'use client';

// Converts a dropped external file into the editor's block descriptors, so
// an imported Word doc / PDF / markdown file / text file / web page ends up
// looking like it was typed directly into the page — same headings, lists,
// quotes, etc. that paste already produces, just sourced from a file
// instead of the clipboard.

import { parseHtmlToBlocks, parseTextToBlocks } from './pasteParser';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];

function extOf(file) {
  const m = /\.([a-z0-9]+)$/i.exec(file.name || '');
  return m ? m[1].toLowerCase() : '';
}

async function blocksFromText(file) {
  return parseTextToBlocks(await file.text());
}

async function blocksFromHtml(file) {
  const html = await file.text();
  const blocks = parseHtmlToBlocks(html);
  return blocks.length > 0 ? blocks : parseTextToBlocks(html);
}

async function blocksFromImage(file) {
  const src = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return [{ type: 'image', content: { src, fileName: file.name } }];
}

async function blocksFromDocx(file) {
  const mod = await import('mammoth');
  const mammoth = mod.default || mod;
  const arrayBuffer = await file.arrayBuffer();
  const { value: html, messages } = await mammoth.convertToHtml({ arrayBuffer });
  if (messages?.length) console.warn('[fileToBlocks] mammoth conversion notes:', messages);
  const blocks = parseHtmlToBlocks(html);
  return blocks.length > 0 ? blocks : parseTextToBlocks(html.replace(/<[^>]+>/g, '\n'));
}

// PDFs have no heading tags or paragraph marks once extracted — pdf.js only
// hands back individual positioned glyph runs. We reconstruct structure from
// the only signal available: each run's font size/weight and its baseline
// position, relative to the page's own dominant body-text size. This is a
// heuristic (no column/table layout detection), but recovers real headings
// and real paragraph breaks instead of flattening a page into one blob.
async function extractPdfLines(pdf) {
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const { items, styles } = await page.getTextContent();

    const pageLines = [];
    let current = null;
    for (const item of items) {
      if (!item.str) continue;
      const size = Math.hypot(item.transform[2], item.transform[3]) || 1;
      const y = item.transform[5];
      const fontFamily = styles?.[item.fontName]?.fontFamily || '';
      const bold = /bold/i.test(fontFamily) || /bold/i.test(item.fontName || '');

      if (current && Math.abs(current.y - y) < Math.max(2, size * 0.4)) {
        current.text += item.str;
        current.maxSize = Math.max(current.maxSize, size);
        current.allBold = current.allBold && bold;
      } else {
        if (current && current.text.trim() !== '') pageLines.push(current);
        current = { text: item.str, y, maxSize: size, allBold: bold, gapBefore: 0 };
      }
    }
    if (current && current.text.trim() !== '') pageLines.push(current);

    for (let i = 1; i < pageLines.length; i++) {
      pageLines[i].gapBefore = Math.abs(pageLines[i - 1].y - pageLines[i].y);
    }

    lines.push(...pageLines, { isPageBreak: true });
  }
  return lines;
}

async function blocksFromPdf(file) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/os/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const lines = await extractPdfLines(pdf);

  const textLines = lines.filter((l) => !l.isPageBreak && l.text.trim() !== '');
  if (textLines.length === 0) return [];

  // The most common line size on the document is treated as "body text" —
  // a mode rather than an average so a handful of big headings can't skew it.
  const sizeCounts = new Map();
  textLines.forEach((l) => {
    const bucket = Math.round(l.maxSize);
    sizeCounts.set(bucket, (sizeCounts.get(bucket) || 0) + 1);
  });
  let bodySize = textLines[0].maxSize;
  let bestCount = 0;
  for (const [size, count] of sizeCounts) {
    if (count > bestCount) { bestCount = count; bodySize = size; }
  }

  const gaps = textLines.map((l) => l.gapBefore).filter((g) => g > 0).sort((a, b) => a - b);
  const typicalGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : bodySize * 1.2;

  const blocks = [];
  let paragraphBuffer = [];
  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      blocks.push({ type: 'paragraph', content: { text: paragraphBuffer.join(' ').replace(/\s+/g, ' ').trim() } });
      paragraphBuffer = [];
    }
  };

  lines.forEach((line) => {
    if (line.isPageBreak) {
      flushParagraph();
      return;
    }
    const text = line.text.replace(/\s+/g, ' ').trim();
    if (!text) return;

    const ratio = line.maxSize / bodySize;
    const isHeadingSize = ratio >= 1.15;
    const standaloneBold = line.allBold && text.length < 90 && ratio < 1.15;

    if (isHeadingSize || standaloneBold) {
      flushParagraph();
      const level = ratio >= 1.6 ? 'h1' : ratio >= 1.3 ? 'h2' : 'h3';
      blocks.push({ type: level, content: { text } });
      return;
    }

    // A noticeably bigger-than-usual gap before this line is where the PDF
    // itself had a paragraph break — split here instead of running every
    // line in the page together into one wall of text.
    if (line.gapBefore > typicalGap * 1.6 && paragraphBuffer.length > 0) {
      flushParagraph();
    }
    paragraphBuffer.push(text);
  });
  flushParagraph();

  return blocks.length > 0 ? blocks : parseTextToBlocks(textLines.map((l) => l.text).join('\n'));
}

const HANDLERS = {
  txt: blocksFromText,
  md: blocksFromText,
  markdown: blocksFromText,
  html: blocksFromHtml,
  htm: blocksFromHtml,
  docx: blocksFromDocx,
  pdf: blocksFromPdf,
};
IMAGE_EXTENSIONS.forEach((ext) => { HANDLERS[ext] = blocksFromImage; });

export const SUPPORTED_EXTENSIONS = Object.keys(HANDLERS);

/**
 * Parses a dropped File into an array of block descriptors (same shape the
 * paste parser produces). Throws an Error with a user-facing message if the
 * type is unsupported or nothing readable was found.
 */
export async function parseFileToBlocks(file) {
  const ext = extOf(file);
  const handler = HANDLERS[ext];
  if (!handler) {
    throw new Error(`"${file.name}" isn't a supported file type (.txt, .md, .html, .docx, .pdf, or an image).`);
  }
  const blocks = await handler(file);
  if (!blocks || blocks.length === 0) {
    throw new Error(`Couldn't find any readable content in "${file.name}".`);
  }
  return blocks;
}
