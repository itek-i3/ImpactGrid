// Shared "download a report" helper for ACR — combines Portfolio Business
// (the `businesses` table) and the Data Registry (`toig_business_registry`)
// into one printable document. It renders the report off-screen, captures it
// with html2canvas, and paginates it into a real A4 PDF with jsPDF — both
// libraries are dynamically imported so they never bloat the main bundle.
// The PDF downloads immediately: no print dialog, no manual "Save as PDF".
import { createClient } from '@/lib/supabase/client';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// TOIG's branded letterhead (corner graphics + watermark), served as a static
// asset so the report's HTML stays small — not inlined as base64. It tiles
// once per A4-page-height down the content so every page gets a copy.
const LETTERHEAD_URL = '/os/toig-letterhead.jpg';

// A4 at 96 CSS px/inch — the fixed width/height the off-screen render uses,
// so the page-height tiling and the later canvas slicing line up exactly.
const PAGE_W = 794;
const PAGE_H = 1123;
// Clearance from the letterhead's decorative corner graphics — big enough on
// page 1 for the title block, and reused on every page (see paginateContent)
// so no page's content runs into the artwork repeating at each tile boundary.
const PAGE_TOP_PAD = 205;
const PAGE_BOTTOM_PAD = 165;
const FRAME_H = PAGE_H - PAGE_TOP_PAD - PAGE_BOTTOM_PAD;

// Section/finding-block accent colors + icon tiles — mirrors the tinted-band +
// icon-tile heading style already used in the in-app report (BusinessIntelPanel's
// .rpt-section-head), so the downloaded PDF reads as the same product.
const ACCENT_HEX = { blue: '#306CEC', teal: '#0EA5A6', amber: '#F5A623', rose: '#E5484D', slate: '#8A94A6' };
const ICONS = {
  barChart: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"></path><path d="M18 17V9"></path><path d="M13 17V5"></path><path d="M8 17v-3"></path></svg>',
  briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>',
};
// Pre-rendered-safe table cell: { badge: 'Managed', tone: 'green' } instead of
// a plain string — lets a cell render as a colored status pill.
const renderCell = (v) => (v && typeof v === 'object' && 'badge' in v)
  ? `<span class="pill-badge tone-${esc(v.tone || 'slate')}">${esc(v.badge)}</span>`
  : esc(v);

export async function fetchPortfolioBusinesses({ agencyId, isDemo }) {
  if (isDemo) {
    try { return JSON.parse(localStorage.getItem(`demo-biz-${agencyId || 'x'}`) || '[]'); } catch (_) { return []; }
  }
  if (!agencyId) return [];
  const { data } = await createClient().from('businesses').select('*').eq('agency_id', agencyId).order('created_at', { ascending: true });
  return data || [];
}

export async function fetchRegistryEntries({ agencyId, isDemo }) {
  if (isDemo) {
    try { return JSON.parse(localStorage.getItem(`demo-toig-registry-${agencyId || 'x'}`) || '[]'); } catch (_) { return []; }
  }
  if (!agencyId) return [];
  const { data } = await createClient().from('toig_business_registry').select('*').eq('agency_id', agencyId).order('created_at', { ascending: true });
  return data || [];
}

// Waits for an <img> at `src` to finish loading (or fail) before html2canvas
// tries to capture it — otherwise the letterhead can get captured blank.
function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // missing image shouldn't block the download
    img.src = src;
  });
}

// The single tall `.page` div is captured as one canvas and sliced into
// PAGE_H-tall chunks for the PDF (see the capture loop in openPrintableReport)
// — mechanical slicing by a fixed pixel height. Left alone, that cuts clean
// through whatever happens to sit at each boundary: a table row sliced in
// half, a section header stranded with its first row on the next page, and
// every page past the first running straight into the letterhead's
// decorative corner graphics (only the very first/last page get the
// `.page`'s own top/bottom clearance).
//
// This walks the already-rendered DOM, decides where each page should
// actually break — only between sibling sections, or between rows/items
// within one table or finding list, never mid-row/mid-item or between a
// section's header and its first row — and inserts sized spacer elements (and
// splits any table/list that has to continue onto a new page, repeating its
// `<thead>`) so every resulting page gets the same top/bottom clearance as
// page 1, and the slice boundaries always land in blank space. Returns the
// total page count.
function paginateContent(idoc, pageEl) {
  const topNodes = Array.from(pageEl.children); // header, each <section>, footer
  if (topNodes.length === 0) return 1;
  const originTop = topNodes[0].getBoundingClientRect().top;
  const relY = (el) => el.getBoundingClientRect().top - originTop;

  // Every top-level sibling after the first is a valid break point; so is
  // every row/item after the first within one table or finding list.
  const candidates = [];
  topNodes.slice(1).forEach((el) => candidates.push({ el, y: relY(el) }));
  topNodes.forEach((sectionEl) => {
    const tbody = sectionEl.querySelector('table tbody');
    if (tbody) Array.from(tbody.children).slice(1).forEach((tr) => candidates.push({ el: tr, y: relY(tr) }));
    const list = sectionEl.querySelector('ol.finding-list');
    if (list) Array.from(list.children).slice(1).forEach((li) => candidates.push({ el: li, y: relY(li) }));
  });
  candidates.sort((a, b) => a.y - b.y);

  // Greedy pagination: walk candidates in order, breaking just before the
  // first one that would overflow the current page's content budget.
  const breaks = [];
  let pageStartY = 0;
  candidates.forEach((c) => {
    if (c.y - pageStartY > FRAME_H) {
      breaks.push(c);
      pageStartY = c.y;
    }
  });

  const lastNode = topNodes[topNodes.length - 1];
  const totalY = lastNode.getBoundingClientRect().bottom - originTop;
  const boundaryYs = [0, ...breaks.map((b) => b.y), totalY];
  const totalPages = breaks.length + 1;

  // Insert a spacer (sized so each frame + its spacer sums to exactly one
  // PAGE_H) before each break element, splitting its table/list if the break
  // falls between rows rather than between sections.
  breaks.forEach((b, i) => {
    const frameH = boundaryYs[i + 1] - boundaryYs[i];
    const spacerH = Math.max(0, PAGE_H - frameH);
    insertPageBreak(idoc, b.el, spacerH, i + 1, totalPages);
  });

  // Pad the final frame out to a full page too, so the total height stays an
  // exact multiple of PAGE_H for the slice loop.
  const lastFrameH = boundaryYs[boundaryYs.length - 1] - boundaryYs[boundaryYs.length - 2];
  const trailingH = Math.max(0, FRAME_H - lastFrameH);
  if (trailingH > 0) {
    const trailing = idoc.createElement('div');
    trailing.style.cssText = `height:${trailingH}px;`;
    pageEl.appendChild(trailing);
  }

  const footer = pageEl.querySelector('footer');
  if (footer) footer.append(idoc.createTextNode(` · Page ${totalPages} of ${totalPages}`));

  return totalPages;
}

// Inserts a page-break spacer immediately before `el`. `el` is either a
// direct child of `.page` (a section/footer — a plain insertBefore is valid)
// or a `<tr>`/`<li>` nested inside a table/list (where a bare spacer can't
// legally sit between siblings, so the table/list is split into two: the
// original keeps everything before `el`, a clone with a repeated `<thead>`
// (for tables) picks up `el` and everything after it).
function insertPageBreak(idoc, el, spacerHeight, pageNum, totalPages) {
  const spacer = idoc.createElement('div');
  spacer.className = 'pdf-pagebreak';
  spacer.style.height = `${spacerHeight}px`;
  spacer.textContent = `Page ${pageNum} of ${totalPages}`;

  const parent = el.parentElement;
  if (parent.tagName === 'TBODY') {
    const table = parent.closest('table');
    const thead = table.querySelector('thead');
    const newTable = idoc.createElement('table');
    newTable.className = table.className;
    if (thead) newTable.appendChild(thead.cloneNode(true));
    const newTbody = idoc.createElement('tbody');
    newTable.appendChild(newTbody);
    let node = el;
    while (node) { const next = node.nextSibling; newTbody.appendChild(node); node = next; }
    table.insertAdjacentElement('afterend', newTable);
    table.insertAdjacentElement('afterend', spacer);
  } else if (parent.tagName === 'OL') {
    const newList = idoc.createElement('ol');
    newList.className = parent.className;
    let node = el;
    while (node) { const next = node.nextSibling; newList.appendChild(node); node = next; }
    parent.insertAdjacentElement('afterend', newList);
    parent.insertAdjacentElement('afterend', spacer);
  } else {
    parent.insertBefore(spacer, el);
  }
}

// Builds a generic multi-section report, renders it off-screen, and saves it
// as a paginated A4 PDF — no print dialog, the download starts immediately.
// `summary` (optional) is a short list of headline stat tiles rendered as an
// "Executive Summary" up top. `findings` (optional) is a list of {title,
// subtitle, items: [{count, text}], emptyText} blocks rendered as ranked,
// plain-English statements ("54 businesses are recorded to need I3
// Launchpad…") — together these are what make it read as a summary report
// rather than a raw data dump.
export async function openPrintableReport({ title, subtitle, filterNote, summary, findings, sections, filename }) {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const generatedAt = new Date().toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });

  const summaryHtml = summary?.length ? `
    <section class="summary">
      <div class="sec-head plain">
        <span class="sec-icon" style="background:#15213A">${ICONS.barChart}</span>
        <h2>Executive Summary</h2>
      </div>
      <div class="stat-grid">
        ${summary.map((s) => `
          <div class="stat-tile" style="--tile-accent:${ACCENT_HEX[s.accent] || ACCENT_HEX.slate}">
            <div class="stat-value">${esc(s.value)}</div>
            <div class="stat-label">${esc(s.label)}</div>
            ${s.note ? `<div class="stat-note">${esc(s.note)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </section>
  ` : '';

  const findingsHtml = findings?.length ? findings.map((f) => {
    const maxCount = Math.max(1, ...f.items.map((it) => it.count));
    return `
    <section class="findings accent-${f.accent || 'slate'}">
      <div class="sec-head">
        <span class="sec-icon">${ICONS[f.icon] || ''}</span>
        <h2>${esc(f.title)}</h2>
      </div>
      ${f.subtitle ? `<p class="sec-sub">${esc(f.subtitle)}</p>` : ''}
      ${f.items.length === 0
        ? `<p class="empty">${esc(f.emptyText || 'Nothing recorded yet.')}</p>`
        : `<ol class="finding-list">
            ${f.items.map((it) => `
              <li>
                <span class="finding-count">${esc(it.count)}</span>
                <div class="finding-body">
                  <span class="finding-text">${esc(it.text)}</span>
                  <div class="finding-bar-track"><div class="finding-bar-fill" style="width:${Math.round((it.count / maxCount) * 100)}%; background:${ACCENT_HEX[f.accent] || ACCENT_HEX.slate}"></div></div>
                </div>
              </li>
            `).join('')}
          </ol>`}
    </section>
  `;
  }).join('') : '';

  const sectionsHtml = sections.map((sec) => `
    <section class="accent-${sec.accent || 'slate'}">
      <div class="sec-head">
        <span class="sec-icon">${ICONS[sec.icon] || ''}</span>
        <h2>${esc(sec.title)}<span class="count">${sec.rows.length}</span></h2>
      </div>
      ${sec.subtitle ? `<p class="sec-sub">${esc(sec.subtitle)}</p>` : ''}
      ${sec.rows.length === 0
        ? `<p class="empty">${esc(sec.emptyText || 'No records yet.')}</p>`
        : `<table>
            <thead><tr>${sec.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
            <tbody>${sec.rows.map((r) => `<tr>${r.map((v) => `<td>${renderCell(v)}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>`}
    </section>
  `).join('');

  const bodyHtml = `
    <div class="page">
      <header>
        <div>
          <h1>${esc(title)}</h1>
          ${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ''}
          ${filterNote ? `<div class="filter-note">Filtered — ${esc(filterNote)}</div>` : ''}
        </div>
        <div class="meta">Generated ${esc(generatedAt)}</div>
      </header>
      ${summaryHtml}
      ${findingsHtml}
      ${sectionsHtml}
      <footer>ImpactGrid — ACR Agency</footer>
    </div>
  `;

  // Rendered inside a hidden iframe — its own document, with its own zoom —
  // rather than a plain off-screen div. ImpactGrid lets a user set a UI zoom
  // level (Settings → Customize) via `document.body.style.zoom`; CSS `zoom`
  // on an ancestor isn't something html2canvas accounts for in its text
  // measurement, and it silently corrupts word-spacing when capturing a
  // descendant of a zoomed body. A same-origin iframe gets a fresh, unzoomed
  // document, which sidesteps the bug entirely — and also a fixed A4 width so
  // the page-height math below lines up with what's drawn.
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:fixed; top:0; left:-10000px; width:${PAGE_W}px; height:600px; border:0;`;
  document.body.appendChild(iframe);
  const idoc = iframe.contentDocument;
  idoc.open();
  idoc.write(`<!doctype html><html><head><meta charset="utf-8" /><style>
      * { box-sizing: border-box; }
      body, .report-root { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #15213A; }
      .report-root {
        background-image: url('${LETTERHEAD_URL}');
        background-size: ${PAGE_W}px ${PAGE_H}px; background-repeat: repeat-y;
      }
      .page { padding: ${PAGE_TOP_PAD}px 52px ${PAGE_BOTTOM_PAD}px; }
      header { display: flex; align-items: flex-end; justify-content: space-between; padding-bottom: 12px; margin-bottom: 22px; border-bottom: 1px solid #E2E6ED; }
      h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -.01em; }
      .sub { font-size: 12.5px; color: #5B6577; margin: 0; }
      .filter-note { display: inline-block; margin-top: 7px; padding: 3px 11px; border-radius: 999px; background: rgba(48,108,236,0.10); color: #306CEC; font-size: 10.5px; font-weight: 700; }
      .meta { text-align: right; font-size: 11px; color: #5B6577; }
      h2 { font-size: 15px; margin: 0; display: flex; align-items: center; gap: 8px; }
      h2 .count { font-size: 11px; font-weight: 700; color: #5B6577; background: #EEF1F7; border-radius: 999px; padding: 1px 9px; }
      .sec-head { display: flex; align-items: center; gap: 10px; padding: 9px 13px 9px 9px; margin-bottom: 12px; border-radius: 10px; }
      .sec-head.plain { background: none; padding: 0; margin-bottom: 14px; }
      .sec-icon { flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 8px; }
      .sec-icon svg { width: 14px; height: 14px; }
      section.accent-blue .sec-head { background: rgba(48,108,236,0.09); }
      section.accent-blue .sec-icon { background: #306CEC; }
      section.accent-teal .sec-head { background: rgba(14,165,166,0.11); }
      section.accent-teal .sec-icon { background: #0EA5A6; }
      section.accent-amber .sec-head { background: rgba(245,166,35,0.14); }
      section.accent-amber .sec-icon { background: #F5A623; }
      section.accent-rose .sec-head { background: rgba(229,72,77,0.11); }
      section.accent-rose .sec-icon { background: #E5484D; }
      section.accent-slate .sec-head { background: rgba(138,148,166,0.13); }
      section.accent-slate .sec-icon { background: #8A94A6; }
      .sec-sub { font-size: 11.5px; color: #5B6577; margin: 0 0 10px; }
      section { margin-bottom: 28px; }
      section.summary { background: rgba(247,249,252,0.92); border: 1px solid #E2E6ED; border-radius: 10px; padding: 18px 20px 20px; }
      .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
      .stat-tile { background: rgba(255,255,255,0.95); border: 1px solid #E2E6ED; border-left: 3px solid var(--tile-accent, #E2E6ED); border-radius: 8px; padding: 12px 14px; }
      .stat-value { font-size: 20px; font-weight: 800; color: #15213A; letter-spacing: -.01em; }
      .stat-label { font-size: 10.5px; font-weight: 700; color: #5B6577; text-transform: uppercase; letter-spacing: .04em; margin-top: 3px; }
      .stat-note { font-size: 10.5px; color: #8A94A6; margin-top: 3px; }
      .finding-list { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 11px; }
      .finding-list li { display: flex; align-items: flex-start; gap: 11px; }
      .finding-count { flex-shrink: 0; min-width: 30px; height: 22px; padding: 0 6px; border-radius: 999px; background: #EEF1F7; color: #15213A; font-weight: 800; font-size: 11.5px; display: flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; }
      .finding-body { flex: 1; min-width: 0; padding-top: 1px; }
      .finding-text { font-size: 12px; line-height: 1.5; color: #2A3348; }
      .finding-bar-track { margin-top: 5px; height: 5px; border-radius: 999px; background: #EEF1F7; overflow: hidden; }
      .finding-bar-fill { height: 100%; border-radius: 999px; }
      table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
      th, td { text-align: left; padding: 7px 9px; border-bottom: 1px solid #E2E6ED; vertical-align: top; }
      th { background: rgba(245,247,250,0.97); font-weight: 700; color: #3A4256; text-transform: uppercase; font-size: 10px; letter-spacing: .04em; }
      tr:nth-child(even) td { background: rgba(250,251,252,0.9); }
      .pill-badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 10px; font-weight: 700; white-space: nowrap; }
      .pill-badge.tone-green { background: rgba(34,197,94,0.15); color: #15803D; }
      .pill-badge.tone-amber { background: rgba(245,166,35,0.18); color: #92600A; }
      .pill-badge.tone-red { background: rgba(229,72,77,0.15); color: #B42318; }
      .pill-badge.tone-slate { background: #EEF1F7; color: #5B6577; }
      .empty { font-size: 12px; color: #8A94A6; font-style: italic; }
      footer { margin-top: 30px; font-size: 10.5px; color: #8A94A6; border-top: 1px solid #E2E6ED; padding-top: 10px; }
      .pdf-pagebreak { flex-shrink: 0; box-sizing: border-box; padding-top: 16px; font-size: 10px; color: #8A94A6; text-align: left; }
    </style></head><body><div class="report-root">${bodyHtml}</div></body></html>`);
  idoc.close();

  try {
    await preloadImage(LETTERHEAD_URL);
    // Let fonts/layout settle before measuring it for pagination.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    paginateContent(idoc, idoc.querySelector('.page'));
    // Let the inserted spacers/split tables settle before the capture.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const scale = 2; // retina-quality output
    const target = idoc.querySelector('.report-root');
    const canvas = await html2canvas(target, {
      scale, useCORS: true, backgroundColor: '#ffffff', width: PAGE_W, windowWidth: PAGE_W,
    });

    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const pageHeightPx = PAGE_H * scale;
    const totalHeightPx = canvas.height;
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    const ctx = pageCanvas.getContext('2d');

    let y = 0;
    let first = true;
    while (y < totalHeightPx) {
      const sliceHeight = Math.min(pageHeightPx, totalHeightPx - y);
      pageCanvas.height = sliceHeight;
      ctx.clearRect(0, 0, pageCanvas.width, sliceHeight);
      ctx.drawImage(canvas, 0, y, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
      const imgData = pageCanvas.toDataURL('image/jpeg', 0.92);
      if (!first) pdf.addPage();
      first = false;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, (sliceHeight / pageHeightPx) * pdfH);
      y += sliceHeight;
    }

    pdf.save(filename || `${title.replace(/[^\w.-]+/g, '-')}.pdf`);
    return true;
  } finally {
    document.body.removeChild(iframe);
  }
}

// Tallies how often each non-empty key (from keyFn) occurs, and returns the
// most frequent one — used to build the Executive Summary's headline stats.
function topEntry(list, keyFn) {
  const counts = new Map();
  list.forEach((item) => {
    const k = keyFn(item);
    if (!k) return;
    counts.set(k, (counts.get(k) || 0) + 1);
  });
  let topKey = null, topCount = 0;
  counts.forEach((c, k) => { if (c > topCount) { topKey = k; topCount = c; } });
  return topKey ? { key: topKey, count: topCount } : null;
}

// Tallies how often each key shows up across every entry's selected list
// (a registry business can select more than one growth need or challenge).
function tallySelections(list, pickSelected) {
  const counts = new Map();
  list.forEach((item) => (pickSelected(item) || []).forEach((k) => counts.set(k, (counts.get(k) || 0) + 1)));
  return counts;
}

// Mirrors the Data Registry's growth-needs and challenges option lists (see
// BusinessIntelPanel) — kept here too so the report has readable names/
// descriptions without importing a page component into a lib util.
const GROWTH_NEEDS = [
  { key: 'i3Launchpad', name: 'I3 Launchpad', desc: 'business growth and operational systems' },
  { key: 'iPlusMarketing', name: 'I+ Marketing', desc: 'marketing and customer acquisition' },
  { key: 'iTekTechnology', name: 'iTek Technology', desc: 'technology, automation and digital systems' },
  { key: 'i3Studios', name: 'I3 Studios', desc: 'creative and media production' },
  { key: 'i3xEvents', name: 'I3X Africa Events', desc: 'connections, platforms and market access' },
  { key: 'impactFund', name: 'ImpactFund', desc: 'capital readiness and financing opportunities' },
  { key: 'impact360', name: 'Impact360', desc: 'ecosystem access and decentralized opportunities' },
];
const CHALLENGES = ['Customer acquisition', 'Cash flow', 'Operations', 'Staffing', 'Technology', 'Marketing', 'Distribution', 'Capital', 'Management', 'Compliance', 'Market access'];

// Ranked, plain-English statements for the report's "Key Findings" sections —
// e.g. "54 businesses are recorded to need I3 Launchpad — ...".
function buildGrowthNeedFindings(registryEntries) {
  const counts = tallySelections(registryEntries, (e) => e.data?.growthNeeds?.selected);
  return GROWTH_NEEDS
    .map((n) => ({ ...n, count: counts.get(n.key) || 0 }))
    .filter((n) => n.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((n) => ({ count: n.count, text: `${n.count === 1 ? 'business is' : 'businesses are'} recorded to need ${n.name} — ${n.desc}.` }));
}
function buildChallengeFindings(registryEntries) {
  const counts = tallySelections(registryEntries, (e) => e.data?.challenges?.selected);
  return CHALLENGES
    .map((label) => ({ label, count: counts.get(label) || 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((c) => ({ count: c.count, text: `${c.count === 1 ? 'business reports' : 'businesses report'} ${c.label} as a challenge.` }));
}

const GROWTH_TRAIL_TONE = { Growing: 'green', Stable: 'amber', Declining: 'red' };

// The nine infrastructure areas a registry entry can be scored on (see
// BusinessIntelPanel's INFRA_AREAS) — kept here just as bare keys, only to
// fall back to "any area" when the infrastructure filter sets a level but no
// specific area.
const INFRA_AREA_KEYS = ['operations', 'finance', 'marketing', 'sales', 'technology', 'hr', 'governance', 'customerMgmt', 'recordKeeping'];

// Combines both rosters into the report both panels link to. `sections` lets a
// caller leave out whole pieces of the document (e.g. the registry page's
// report-options modal), `registryEntries` lets a caller hand in an already-
// filtered list (e.g. the registry page's on-screen country/city/registrar
// filters) instead of re-fetching the full table, and `filters` narrows the
// two rosters further — one entry per Data Registry wizard step:
//   - operatingModel (Operations), growthTrend (Performance)
//   - infraArea + infraLevel (Infrastructure — area alone is a no-op; level
//     alone matches that level in ANY area)
//   - challenge (Challenges), growthNeed (Growth needs — a GROWTH_NEEDS key)
//   - managedStatus (Portfolio Business only — not a registry field)
export async function downloadAcrCombinedReport({
  agencyId, isDemo, agencyName,
  registryEntries: registryOverride,
  sections,
  filters,
  filterNote,
}) {
  const sec = { summary: true, findings: true, portfolio: true, registry: true, ...sections };
  const [businessesRaw, registryRaw] = await Promise.all([
    sec.portfolio ? fetchPortfolioBusinesses({ agencyId, isDemo }) : Promise.resolve([]),
    sec.registry ? (registryOverride ?? fetchRegistryEntries({ agencyId, isDemo })) : Promise.resolve([]),
  ]);

  const managedStatus = filters?.managedStatus; // '' | 'managed' | 'not-managed'
  const businesses = managedStatus
    ? businessesRaw.filter((b) => (managedStatus === 'managed' ? b.managed !== false : b.managed === false))
    : businessesRaw;

  const { operatingModel, growthTrend, infraArea, infraLevel, challenge, growthNeed } = filters || {};
  const registryEntries = registryRaw.filter((e) => {
    const d = e.data || {};
    if (operatingModel && (d.operations?.operatingModel || '') !== operatingModel) return false;
    if (growthTrend && (d.performance?.growthTrend || '') !== growthTrend) return false;
    if (infraLevel) {
      const areas = infraArea ? [infraArea] : INFRA_AREA_KEYS;
      if (!areas.some((a) => (d.infrastructure?.[a]?.level || '') === infraLevel)) return false;
    }
    if (challenge && !(d.challenges?.selected || []).includes(challenge)) return false;
    if (growthNeed && !(d.growthNeeds?.selected || []).includes(growthNeed)) return false;
    return true;
  });

  // ── Executive summary — headline stats, only for the rosters included ──
  const managedCount = businesses.filter((b) => b.managed !== false).length;
  const topSector = topEntry(businesses, (b) => b.sector);
  const topIndustry = topEntry(registryEntries, (e) => e.industry);

  const genders = registryEntries.map((e) => e.data?.identity?.ownerGender).filter(Boolean);
  const femaleCount = genders.filter((g) => g === 'Female').length;
  const femalePct = genders.length ? Math.round((femaleCount / genders.length) * 100) : null;

  const trends = registryEntries.map((e) => e.data?.performance?.growthTrend).filter(Boolean);
  const growingCount = trends.filter((t) => t === 'Growing').length;
  const growingPct = trends.length ? Math.round((growingCount / trends.length) * 100) : null;

  const summary = [];
  if (sec.portfolio || sec.registry) {
    summary.push({ label: 'Total Businesses Tracked', value: String(businesses.length + registryEntries.length), accent: 'slate' });
  }
  if (sec.portfolio) {
    summary.push({ label: 'Portfolio Business', value: String(businesses.length), note: `${managedCount} actively managed`, accent: 'blue' });
    summary.push({ label: 'Leading Portfolio Sector', value: topSector ? topSector.key : '—', note: topSector ? `${topSector.count} of ${businesses.length} businesses` : 'No entries yet', accent: 'blue' });
  }
  if (sec.registry) {
    summary.push({ label: 'Data Registry', value: String(registryEntries.length), note: topIndustry ? `Leading industry: ${topIndustry.key}` : 'No entries yet', accent: 'teal' });
    summary.push({ label: 'On a Growth Trajectory', value: growingPct != null ? `${growingPct}%` : '—', note: trends.length ? `${growingCount} of ${trends.length} registry businesses` : 'No data recorded yet', accent: 'teal' });
    summary.push({ label: 'Female-Owned', value: femalePct != null ? `${femalePct}%` : '—', note: genders.length ? `${femaleCount} of ${genders.length} with gender recorded` : 'No data recorded yet', accent: 'teal' });
  }

  const bizRows = businesses.map((b) => [
    b.name || '—',
    b.sector || '—',
    b.domain || '—',
    b.location || '—',
    b.handler || '—',
    b.finance_period === 'monthly' ? 'Monthly' : b.finance_period === 'yearly' ? 'Yearly' : 'Daily',
    { badge: b.managed === false ? 'Not managed' : 'Managed', tone: b.managed === false ? 'slate' : 'green' },
  ]);

  const regRows = registryEntries.map((e) => {
    const d = e.data || {};
    const id = d.identity || {};
    const perf = d.performance || {};
    return [
      e.name || '—',
      e.industry || '—',
      e.location || '—',
      id.ownerName || '—',
      id.ownerGender || '—',
      perf.revenueRange || '—',
      perf.growthTrend ? { badge: perf.growthTrend, tone: GROWTH_TRAIL_TONE[perf.growthTrend] || 'slate' } : '—',
      (d.registeredBy || '').trim() || '—',
    ];
  });

  const findings = (sec.findings && sec.registry) ? [
    {
      title: 'Top Support Needs', icon: 'target', accent: 'amber', items: buildGrowthNeedFindings(registryEntries),
      subtitle: 'Where TOIG support is requested most across the Data Registry.',
      emptyText: 'No growth needs recorded yet.',
    },
    {
      title: 'Top Challenges', icon: 'alert', accent: 'rose', items: buildChallengeFindings(registryEntries),
      subtitle: 'What registry businesses report as holding them back.',
      emptyText: 'No challenges recorded yet.',
    },
  ] : [];

  const reportSections = [];
  if (sec.portfolio) {
    reportSections.push({
      title: 'Portfolio Business', icon: 'briefcase', accent: 'blue', rows: bizRows,
      subtitle: 'Businesses ACR personally owns and tracks finances for.',
      columns: ['Name', 'Sector', 'Domain', 'Location', 'Handled by', 'Tracking', 'Status'],
      emptyText: 'No Portfolio Business entries yet.',
    });
  }
  if (sec.registry) {
    reportSections.push({
      title: 'Data Registry', icon: 'users', accent: 'teal', rows: regRows,
      subtitle: "TOIG's roster of businesses it works with.",
      columns: ['Name', 'Industry', 'Location', 'Owner', 'Gender', 'Revenue range', 'Growth trend', 'Registered by'],
      emptyText: 'No Data Registry entries yet.',
    });
  }

  const dateStamp = new Date().toISOString().slice(0, 10);

  return openPrintableReport({
    title: 'ACR Business Report',
    subtitle: agencyName || 'ACR Agency',
    filterNote,
    summary: sec.summary ? summary : [],
    findings,
    filename: `ACR-Business-Report-${dateStamp}.pdf`,
    sections: reportSections,
  });
}
