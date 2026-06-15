import { ok, badRequest, forbidden, fromSupabaseError } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

// Helper — insert a page and return its id
async function insertPage(supabase, { workspaceId, parentId = null, title, icon, sortOrder = 0, userId }) {
  const { data, error } = await supabase
    .from('pages')
    .insert({ workspace_id: workspaceId, parent_id: parentId, title, icon, sort_order: sortOrder, created_by: userId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

// Helper — insert a block
async function insertBlock(supabase, { pageId, type, content = {}, properties = {}, sortOrder = 0 }) {
  const { error } = await supabase
    .from('blocks')
    .insert({ page_id: pageId, type, content, properties, sort_order: sortOrder });
  if (error) throw error;
}

// Shorthand block builders
const heading = (text, level = 'h2') => ({ type: level, content: { text }, properties: {} });
const text    = (t)                   => ({ type: 'text',    content: { text: t }, properties: {} });
const callout = (t, color = 'blue', icon = '💡') => ({ type: 'callout', content: { text: t }, properties: { color, icon } });
const divider = ()                    => ({ type: 'divider', content: {}, properties: {} });
const table   = (rows, columnTypes)   => ({ type: 'table',   content: { rows }, properties: { columnTypes } });

// ── Page definitions ────────────────────────────────────────────

const MONTH_ROWS = [
  ['January', '', '', ''],
  ['February', '', '', ''],
  ['March', '', '', ''],
  ['April', '', '', ''],
  ['May', '', '', ''],
  ['June', '', '', ''],
  ['July', '', '', ''],
  ['August', '', '', ''],
  ['September', '', '', ''],
  ['October', '', '', ''],
  ['November', '', '', ''],
  ['December', '', '', ''],
];

const PAGES = [
  {
    title: 'Goals',
    icon: '🎯',
    sort: 0,
    blocks: [
      heading('Project Goals', 'h1'),
      callout('Create a sub-page for each project. Track its goal, owner, deadline, and status here.', 'blue', '🎯'),
      divider(),
      heading('Overview', 'h2'),
      table(
        [
          ['Project', 'Goal', 'Owner', 'Status', 'Deadline'],
          ['', '', '', '', ''],
          ['', '', '', '', ''],
          ['', '', '', '', ''],
        ],
        ['text', 'text', 'text', 'text', 'date']
      ),
    ],
  },
  {
    title: 'Financial Tracking',
    icon: '💰',
    sort: 1,
    blocks: [
      heading('Financial Tracking', 'h1'),
      callout('Use the sub-pages to track revenue, losses, expenditure, revenue models, and rate cards.', 'green', '💰'),
    ],
    children: [
      {
        title: 'Revenue Tracker',
        icon: '📈',
        sort: 0,
        blocks: [
          heading('Revenue Tracker', 'h1'),
          callout('Compare your goal revenue vs actual revenue each month. Variance is auto-calculated.', 'green', '📈'),
          divider(),
          {
            type: 'table',
            content: { rows: [['Month', 'Goal Revenue', 'Actual Revenue', 'Variance'], ...MONTH_ROWS] },
            properties: {
              columnTypes: ['text', 'currency', 'currency', 'formula'],
              columnFormulas: { '3': { colA: 2, op: '-', colB: 1 } },
              showTotals: true,
            },
          },
        ],
      },
      {
        title: 'Loss Analysis',
        icon: '📉',
        sort: 1,
        blocks: [
          heading('Loss Analysis', 'h1'),
          callout('Record where revenue was lost — client drop-offs, project cancellations, scope reductions.', 'red', '📉'),
          divider(),
          { type: 'table', content: { rows: [
              ['Month', 'Loss Source', 'Amount Lost', 'Root Cause', 'Action Taken'],
              ['', '', '', '', ''], ['', '', '', '', ''],
              ['', '', '', '', ''], ['', '', '', '', ''],
            ]}, properties: { columnTypes: ['text', 'text', 'currency', 'text', 'text'], showTotals: true } },
        ],
      },
      {
        title: 'Expenditure',
        icon: '💸',
        sort: 2,
        blocks: [
          heading('Expenditure', 'h1'),
          callout('Track all outgoing costs — tools, salaries, freelancers, office, marketing.', 'yellow', '💸'),
          divider(),
          { type: 'table', content: { rows: [
              ['Category', 'Description', 'Amount', 'Date', 'Approved By'],
              ['', '', '', '', ''], ['', '', '', '', ''],
              ['', '', '', '', ''], ['', '', '', '', ''],
            ]}, properties: { columnTypes: ['text', 'text', 'currency', 'date', 'text'], showTotals: true } },
        ],
      },
      {
        title: 'Revenue Models',
        icon: '🔄',
        sort: 3,
        blocks: [
          heading('Revenue Models', 'h1'),
          callout('List every way the business generates income. Mark which models are active and which are targets.', 'purple', '🔄'),
          divider(),
          table(
            [
              ['Revenue Model', 'Description', 'Status', 'Monthly Target', 'Notes'],
              ['Project-based', '', 'Active', '', ''],
              ['Retainer', '', 'Target', '', ''],
              ['Consulting', '', 'Target', '', ''],
              ['', '', '', '', ''],
            ],
            ['text', 'text', 'text', 'currency', 'text']
          ),
        ],
      },
      {
        title: 'Rate Cards',
        icon: '💳',
        sort: 4,
        blocks: [
          heading('Rate Cards', 'h1'),
          callout('List every service Itek provides with its quoted rate. Update when pricing changes.', 'blue', '💳'),
          divider(),
          heading('Project-Based Services', 'h2'),
          table(
            [
              ['Service / Deliverable', 'Description', 'Rate (USD)', 'Currency', 'Notes'],
              ['', '', '', 'USD', ''],
              ['', '', '', 'USD', ''],
              ['', '', '', 'USD', ''],
              ['', '', '', 'USD', ''],
              ['', '', '', 'USD', ''],
            ],
            ['text', 'text', 'currency', 'text', 'text']
          ),
        ],
      },
    ],
  },
  {
    title: 'Growth Models',
    icon: '🚀',
    sort: 2,
    blocks: [
      heading('Growth Models', 'h1'),
      callout('Map out the strategies driving growth — new markets, partnerships, product expansion, team scale.', 'purple', '🚀'),
      divider(),
      heading('Current Growth Levers', 'h2'),
      table(
        [
          ['Growth Area', 'Strategy', 'Owner', 'Status', 'Target Outcome', 'Timeline'],
          ['', '', '', '', '', ''],
          ['', '', '', '', '', ''],
          ['', '', '', '', '', ''],
        ],
        ['text', 'text', 'text', 'text', 'text', 'text']
      ),
      divider(),
      heading('KPIs to Watch', 'h2'),
      table(
        [
          ['Metric', 'Current Value', 'Target', 'Deadline'],
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
        ],
        ['text', 'text', 'text', 'date']
      ),
    ],
  },
  {
    title: 'Innovation Box',
    icon: '💡',
    sort: 3,
    blocks: [
      heading('Innovation Box', 'h1'),
      callout('Drop any idea here — no filter. Review monthly, move the best ones into Goals or Growth Models.', 'yellow', '💡'),
      divider(),
      heading('Ideas', 'h2'),
      table(
        [
          ['Idea', 'Submitted By', 'Date', 'Potential Impact', 'Status'],
          ['', '', '', '', 'New'],
          ['', '', '', '', 'New'],
          ['', '', '', '', 'New'],
          ['', '', '', '', 'New'],
        ],
        ['text', 'text', 'date', 'text', 'text']
      ),
    ],
  },
];

export async function POST(request, { params }) {
  const { id: workspaceId } = await params;

  const authClient = await createClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return badRequest('Unauthorized');

  // Only managers and superadmins can seed
  const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role === 'member') return forbidden('Only managers can set up the workspace');

  // Use admin client to bypass RLS for cross-agency superadmins, regular client otherwise
  const supabase = profile.role === 'superadmin' && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createAdminClient()
    : authClient;

  try {
    for (const page of PAGES) {
      const parentId = await insertPage(supabase, {
        workspaceId,
        title: page.title,
        icon: page.icon,
        sortOrder: page.sort,
        userId: user.id,
      });

      for (let i = 0; i < page.blocks.length; i++) {
        await insertBlock(supabase, { pageId: parentId, ...page.blocks[i], sortOrder: i });
      }

      if (page.children) {
        for (const child of page.children) {
          const childId = await insertPage(supabase, {
            workspaceId,
            parentId,
            title: child.title,
            icon: child.icon,
            sortOrder: child.sort,
            userId: user.id,
          });

          for (let i = 0; i < child.blocks.length; i++) {
            await insertBlock(supabase, { pageId: childId, ...child.blocks[i], sortOrder: i });
          }
        }
      }
    }

    return ok({ message: 'Workspace set up successfully' });
  } catch (err) {
    console.error('Seed error:', err);
    return fromSupabaseError(err);
  }
}
