// Shared "download a report" helper for ACR — combines Portfolio Business
// (the `businesses` table) and the Data Registry (`toig_business_registry`)
// into one printable document. No new dependency: it opens a plain HTML page
// in a new tab and triggers the browser's print dialog, where "Save as PDF"
// produces an actual document file.
import { createClient } from '@/lib/supabase/client';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
export function openPrintableReport({ title, subtitle, sections }) {
  const win = window.open('', '_blank');
  if (!win) return false;

  const generatedAt = new Date().toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });

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
  body { font-family: -apple-system, Segoe UI, Arial, sans-serif; color: #15213A; margin: 0; padding: 36px 44px; }
  header { display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 2px solid #15213A; padding-bottom: 14px; margin-bottom: 26px; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -.01em; }
  .sub { font-size: 12.5px; color: #5B6577; margin: 0; }
  .meta { text-align: right; font-size: 11px; color: #5B6577; }
  h2 { font-size: 15px; margin: 0 0 4px; display: flex; align-items: center; gap: 8px; }
  h2 .count { font-size: 11px; font-weight: 700; color: #5B6577; background: #EEF1F7; border-radius: 999px; padding: 1px 9px; }
  .sec-sub { font-size: 11.5px; color: #5B6577; margin: 0 0 10px; }
  section { margin-bottom: 30px; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  th, td { text-align: left; padding: 7px 9px; border-bottom: 1px solid #E2E6ED; vertical-align: top; }
  th { background: #F5F7FA; font-weight: 700; color: #3A4256; text-transform: uppercase; font-size: 10px; letter-spacing: .04em; }
  tr:nth-child(even) td { background: #FAFBFC; }
  .empty { font-size: 12px; color: #8A94A6; font-style: italic; }
  footer { margin-top: 30px; font-size: 10.5px; color: #8A94A6; border-top: 1px solid #E2E6ED; padding-top: 10px; }
  @media print {
    body { padding: 18px 24px; }
    section { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <header>
    <div>
      <h1>${esc(title)}</h1>
      ${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ''}
    </div>
    <div class="meta">Generated ${esc(generatedAt)}</div>
  </header>
  ${sectionsHtml}
  <footer>ImpactGrid — ACR Agency</footer>
</body>
</html>`);
  win.document.close();
  win.focus();
  // Give the new document a beat to lay out before the print dialog opens.
  setTimeout(() => { try { win.print(); } catch (_) {} }, 350);
  return true;
}

// Combines both rosters into the two-section report both panels link to.
export async function downloadAcrCombinedReport({ agencyId, isDemo, agencyName }) {
  const [businesses, registryEntries] = await Promise.all([
    fetchPortfolioBusinesses({ agencyId, isDemo }),
    fetchRegistryEntries({ agencyId, isDemo }),
  ]);

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

  return openPrintableReport({
    title: 'ACR Business Report',
    subtitle: agencyName || 'ACR Agency',
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
