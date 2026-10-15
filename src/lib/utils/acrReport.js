// Shared "download a report" helper for ACR — combines Portfolio Business
// (the `businesses` table) and the Data Registry (`toig_business_registry`)
// into one printable document. No new dependency: it opens a plain HTML page
// in a new tab and triggers the browser's print dialog, where "Save as PDF"
// produces an actual document file.
import { createClient } from '@/lib/supabase/client';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// TOIG's branded letterhead (corner graphics + watermark), served as a static
// asset so the report's HTML stays small — not inlined as base64.
const LETTERHEAD_URL = '/os/toig-letterhead.jpg';

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

// Renders a generic multi-section report as a standalone HTML document in a new
// tab and opens the print dialog — "Save as PDF" there is the downloadable document.
// `summary` (optional) is a short list of headline stat tiles rendered as an
// "Executive Summary" up top. `findings` (optional) is a list of {title,
// subtitle, items: [{count, text}], emptyText} blocks rendered as ranked,
// plain-English statements ("54 businesses are recorded to need I3
// Launchpad…") — together these are what make it read as a summary report
// rather than a raw data dump.
export function openPrintableReport({ title, subtitle, summary, findings, sections }) {
  const win = window.open('', '_blank');
  if (!win) return false;

  const generatedAt = new Date().toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });

  const summaryHtml = summary?.length ? `
    <section class="summary">
      <h2>Executive Summary</h2>
      <div class="stat-grid">
        ${summary.map((s) => `
          <div class="stat-tile">
            <div class="stat-value">${esc(s.value)}</div>
            <div class="stat-label">${esc(s.label)}</div>
            ${s.note ? `<div class="stat-note">${esc(s.note)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </section>
  ` : '';

  const findingsHtml = findings?.length ? findings.map((f) => `
    <section class="findings">
      <h2>${esc(f.title)}</h2>
      ${f.subtitle ? `<p class="sec-sub">${esc(f.subtitle)}</p>` : ''}
      ${f.items.length === 0
        ? `<p class="empty">${esc(f.emptyText || 'Nothing recorded yet.')}</p>`
        : `<ol class="finding-list">
            ${f.items.map((it) => `<li><span class="finding-count">${esc(it.count)}</span><span class="finding-text">${esc(it.text)}</span></li>`).join('')}
          </ol>`}
    </section>
  `).join('') : '';

  const sectionsHtml = sections.map((sec) => `
    <section>
      <h2>${esc(sec.title)}<span class="count">${sec.rows.length}</span></h2>
      ${sec.subtitle ? `<p class="sec-sub">${esc(sec.subtitle)}</p>` : ''}
      ${sec.rows.length === 0
        ? `<p class="empty">${esc(sec.emptyText || 'No records yet.')}</p>`
        : `<table>
            <thead><tr>${sec.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
            <tbody>${sec.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>`}
    </section>
  `).join('');

  win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  @page { size: A4; margin: 0; }
  html, body { margin: 0; }
  body { font-family: -apple-system, Segoe UI, Arial, sans-serif; color: #15213A; }
  .letterhead-bg {
    position: fixed; inset: 0; width: 100%; height: 100%;
    background-image: url('${LETTERHEAD_URL}'); background-size: 100% 100%; background-repeat: no-repeat;
    z-index: -1;
  }
  .page { padding: 205px 52px 165px; position: relative; }
  .print-tip { font-size: 11px; color: #8A94A6; background: #FFF8E6; border: 1px solid #F0DFAE; border-radius: 8px; padding: 8px 12px; margin-bottom: 20px; }
  header { display: flex; align-items: flex-end; justify-content: space-between; padding-bottom: 12px; margin-bottom: 22px; border-bottom: 1px solid #E2E6ED; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -.01em; }
  .sub { font-size: 12.5px; color: #5B6577; margin: 0; }
  .meta { text-align: right; font-size: 11px; color: #5B6577; }
  h2 { font-size: 15px; margin: 0 0 4px; display: flex; align-items: center; gap: 8px; }
  h2 .count { font-size: 11px; font-weight: 700; color: #5B6577; background: #EEF1F7; border-radius: 999px; padding: 1px 9px; }
  .sec-sub { font-size: 11.5px; color: #5B6577; margin: 0 0 10px; }
  section { margin-bottom: 30px; }
  section.summary { background: rgba(247,249,252,0.9); border: 1px solid #E2E6ED; border-radius: 10px; padding: 18px 20px 20px; }
  section.summary h2 { margin-bottom: 14px; }
  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .stat-tile { background: rgba(255,255,255,0.92); border: 1px solid #E2E6ED; border-radius: 8px; padding: 12px 14px; }
  .stat-value { font-size: 20px; font-weight: 800; color: #15213A; letter-spacing: -.01em; }
  .stat-label { font-size: 10.5px; font-weight: 700; color: #5B6577; text-transform: uppercase; letter-spacing: .04em; margin-top: 3px; }
  .stat-note { font-size: 10.5px; color: #8A94A6; margin-top: 3px; }
  .finding-list { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
  .finding-list li { display: flex; align-items: flex-start; gap: 11px; }
  .finding-count { flex-shrink: 0; min-width: 30px; height: 22px; padding: 0 6px; border-radius: 999px; background: #EEF1F7; color: #15213A; font-weight: 800; font-size: 11.5px; display: flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; }
  .finding-text { font-size: 12px; line-height: 1.55; padding-top: 2px; color: #2A3348; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  th, td { text-align: left; padding: 7px 9px; border-bottom: 1px solid #E2E6ED; vertical-align: top; }
  th { background: rgba(245,247,250,0.95); font-weight: 700; color: #3A4256; text-transform: uppercase; font-size: 10px; letter-spacing: .04em; }
  tr:nth-child(even) td { background: rgba(250,251,252,0.85); }
  .empty { font-size: 12px; color: #8A94A6; font-style: italic; }
  footer { margin-top: 30px; font-size: 10.5px; color: #8A94A6; border-top: 1px solid #E2E6ED; padding-top: 10px; }
  @media print {
    .print-tip { display: none; }
    section { page-break-inside: avoid; }
    .letterhead-bg, section.summary, .stat-tile, th, tr:nth-child(even) td {
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
  }
</style>
</head>
<body>
  <div class="letterhead-bg" aria-hidden="true"></div>
  <div class="page">
    <p class="print-tip">Tip: in the print dialog, open "More settings" and enable "Background graphics" so the TOIG letterhead appears on the saved PDF.</p>
    <header>
      <div>
        <h1>${esc(title)}</h1>
        ${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ''}
      </div>
      <div class="meta">Generated ${esc(generatedAt)}</div>
    </header>
    ${summaryHtml}
    ${findingsHtml}
    ${sectionsHtml}
    <footer>ImpactGrid — ACR Agency</footer>
  </div>
</body>
</html>`);
  win.document.close();
  win.focus();
  // Give the new document a beat to lay out before the print dialog opens.
  setTimeout(() => { try { win.print(); } catch (_) {} }, 350);
  return true;
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

// Combines both rosters into the two-section report both panels link to.
export async function downloadAcrCombinedReport({ agencyId, isDemo, agencyName }) {
  const [businesses, registryEntries] = await Promise.all([
    fetchPortfolioBusinesses({ agencyId, isDemo }),
    fetchRegistryEntries({ agencyId, isDemo }),
  ]);

  // ── Executive summary — headline stats computed from both rosters ──
  const managedCount = businesses.filter((b) => b.managed !== false).length;
  const topSector = topEntry(businesses, (b) => b.sector);
  const topIndustry = topEntry(registryEntries, (e) => e.industry);

  const genders = registryEntries.map((e) => e.data?.identity?.ownerGender).filter(Boolean);
  const femaleCount = genders.filter((g) => g === 'Female').length;
  const femalePct = genders.length ? Math.round((femaleCount / genders.length) * 100) : null;

  const trends = registryEntries.map((e) => e.data?.performance?.growthTrend).filter(Boolean);
  const growingCount = trends.filter((t) => t === 'Growing').length;
  const growingPct = trends.length ? Math.round((growingCount / trends.length) * 100) : null;

  const summary = [
    { label: 'Total Businesses Tracked', value: String(businesses.length + registryEntries.length) },
    { label: 'Portfolio Business', value: String(businesses.length), note: `${managedCount} actively managed` },
    { label: 'Data Registry', value: String(registryEntries.length), note: topIndustry ? `Leading industry: ${topIndustry.key}` : 'No entries yet' },
    { label: 'On a Growth Trajectory', value: growingPct != null ? `${growingPct}%` : '—', note: trends.length ? `${growingCount} of ${trends.length} registry businesses` : 'No data recorded yet' },
    { label: 'Female-Owned', value: femalePct != null ? `${femalePct}%` : '—', note: genders.length ? `${femaleCount} of ${genders.length} with gender recorded` : 'No data recorded yet' },
    { label: 'Leading Portfolio Sector', value: topSector ? topSector.key : '—', note: topSector ? `${topSector.count} of ${businesses.length} businesses` : 'No entries yet' },
  ];

  const bizRows = businesses.map((b) => [
    b.name || '—',
    b.sector || '—',
    b.domain || '—',
    b.location || '—',
    b.handler || '—',
    b.finance_period === 'monthly' ? 'Monthly' : b.finance_period === 'yearly' ? 'Yearly' : 'Daily',
    b.managed === false ? 'Not managed' : 'Managed',
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
      perf.growthTrend || '—',
      (d.registeredBy || '').trim() || '—',
    ];
  });

  const findings = [
    {
      title: 'Top Support Needs', items: buildGrowthNeedFindings(registryEntries),
      subtitle: 'Where TOIG support is requested most across the Data Registry.',
      emptyText: 'No growth needs recorded yet.',
    },
    {
      title: 'Top Challenges', items: buildChallengeFindings(registryEntries),
      subtitle: 'What registry businesses report as holding them back.',
      emptyText: 'No challenges recorded yet.',
    },
  ];

  return openPrintableReport({
    title: 'ACR Business Report',
    subtitle: agencyName || 'ACR Agency',
    summary,
    findings,
    sections: [
      {
        title: 'Portfolio Business', rows: bizRows,
        subtitle: 'Businesses ACR personally owns and tracks finances for.',
        columns: ['Name', 'Sector', 'Domain', 'Location', 'Handled by', 'Tracking', 'Status'],
        emptyText: 'No Portfolio Business entries yet.',
      },
      {
        title: 'Data Registry', rows: regRows,
        subtitle: "TOIG's roster of businesses it works with.",
        columns: ['Name', 'Industry', 'Location', 'Owner', 'Gender', 'Revenue range', 'Growth trend', 'Registered by'],
        emptyText: 'No Data Registry entries yet.',
      },
    ],
  });
}
