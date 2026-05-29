/**
 * LoopC knowledge base — module guides, FAQs, navigation, workflows.
 * Scored keyword matching (no external LLM).
 */

const MODULE_GUIDES = [
  {
    id: 'erp',
    keys: ['erp', 'accounting', 'finance module', 'chart of accounts', 'coa'],
    title: 'ERP & Accounting',
    body: [
      '**ERP** is the core accounting module for **MG / CG / Loopc**.',
      '',
      '| Area | Tab | What you do |',
      '|------|-----|-------------|',
      '| Vouchers | ERP → Vouchers | Payment, receipt, journal, metal stock entries |',
      '| Ledger | ERP → Ledger | Account balances, journal lines, enquiry |',
      '| Inventory | ERP → Inventory | Raw material, WIP, finished goods, stock moves |',
      '| Vendors | ERP → Vendors | Supplier onboarding, compliance docs, approvals |',
      '| Reports | ERP → Reports | Trial balance, P&L, balance sheet, cash flow |',
      '| Settings | ERP → Settings | Currencies, metal rates, account mappings |',
      '',
      'Metal vouchers can pull **live spot** from the top bar when MT4 or market feed is online.',
    ].join('\n'),
  },
  {
    id: 'vouchers',
    keys: ['voucher', 'post voucher', 'create voucher', 'journal entry', 'payment voucher', 'receipt voucher', 'metal voucher'],
    title: 'Vouchers',
    body: [
      '**How to create a voucher:**',
      '1. Open **ERP → Vouchers**',
      '2. Pick type: payment, receipt, journal, metal receipt/payment, etc.',
      '3. Fill header (date, party, currency) and line items',
      '4. Attach supporting documents if required',
      '5. **Save** as draft → **Submit** → **Approve** → **Post** (workflow depends on role)',
      '',
      '**Tips:**',
      '- HTTP 403 on save = missing write permission — ask Super Admin',
      '- Metal lines use live gold/silver/platinum from top bar',
      '- Draft vouchers stay editable until posted',
    ].join('\n'),
  },
  {
    id: 'ledger',
    keys: ['ledger', 'trial balance', 'balance sheet', 'p&l', 'profit and loss', 'account enquiry', 'journal'],
    title: 'Ledger & Reports',
    body: [
      '**Ledger:** ERP → Ledger — view entries by account, filter by date, export.',
      '**Trial balance:** ERP → Reports → Trial Balance — debits vs credits snapshot.',
      '**P&L / Balance sheet:** ERP → Reports — pick date range, run report.',
      '**Party balances:** Account enquiry shows customer/vendor aging.',
      '',
      'Posted vouchers create ledger entries automatically via account mappings.',
    ].join('\n'),
  },
  {
    id: 'inventory',
    keys: ['inventory', 'stock', 'warehouse', 'raw material', 'wip', 'finished good', 'low stock'],
    title: 'Inventory',
    body: [
      '**ERP → Inventory** tracks stock by type:',
      '- **Raw material** — inputs for production',
      '- **WIP** — work in progress',
      '- **Finished goods** — ready to sell',
      '',
      'Set **min threshold** per item — LoopC alerts when stock is low.',
      'Metal inventory can be valued using live top-bar prices.',
      'Stock movements link to vouchers and production orders.',
    ].join('\n'),
  },
  {
    id: 'crm',
    keys: ['crm', 'sales', 'pipeline', 'deal', 'lead', 'contact', 'follow up', 'follow-up'],
    title: 'CRM & Sales',
    body: [
      '**CRM tab** — contacts, leads, deals, activities.',
      '',
      '| Metric | Where |',
      '|--------|-------|',
      '| Pipeline value | CRM dashboard |',
      '| Hot leads | CRM → Leads (filter temperature) |',
      '| Overdue follow-ups | CRM → Activities |',
      '| Win rate | CRM dashboard |',
      '',
      'Sales reps see only their assigned records; Sales Head / Admin see all.',
    ].join('\n'),
  },
  {
    id: 'hr',
    keys: ['hr', 'employee', 'attendance', 'leave', 'payroll', 'staff'],
    title: 'HR',
    body: [
      '**HR tab** — employees, attendance, leave requests.',
      'Department heads manage their team; HR head sees all.',
      'Payroll may flow to Finance / ERP depending on tenant setup.',
      'Ask **"show HR summary"** for live employee and task counts.',
    ].join('\n'),
  },
  {
    id: 'mt4',
    keys: ['mt4', 'bridge', 'waiting mt4', 'price not show', 'live price', 'xau', 'xag', 'xpt', 'equiti', 'metal feed'],
    title: 'MT4 Live Prices',
    body: [
      '**Price flow:** Equiti MT4 EA → `api.loopcstrategies.com` bridge → dashboard top bar (USD/OZ).',
      '',
      '**Checklist:**',
      '1. MT4 logged in (not "Invalid account")',
      '2. **AutoTrading** green ON',
      '3. EA **EquitiMetalPriceBridge** on chart — smiley face',
      '4. Inputs: BridgeUrl, BridgeToken, Tenant=mg|cg|loopc',
      '5. Symbols: `XAUUSD.pr`, `XAGUSD.pr`, `XPTUSD.pr`',
      '6. Experts tab: "posted Gold/Silver/Platinum ticks"',
      '7. Hard refresh dashboard (Ctrl+F5)',
      '',
      'If MT4 is down, server **market fallback** may still show prices (not live MT4).',
    ].join('\n'),
  },
  {
    id: 'permissions',
    keys: ['permission', '403', 'forbidden', 'cannot save', "can't save", 'access denied', 'role', 'admin'],
    title: 'Permissions',
    body: [
      'HTTP **403** = your role lacks write access for that action.',
      '',
      '**Roles:** super_admin, management (read-only), department_head, department_user, external.',
      '**Granular ERP permissions:** vouchers, ledger, inventory, vendors, reports — set separately.',
      '',
      'Super Admin → **Admin → Users** → edit user → module permissions.',
      'After update, user must refresh the page.',
    ].join('\n'),
  },
  {
    id: 'tenants',
    keys: ['tenant', 'mg', 'cg', 'loopc', 'wrong company', 'multi tenant', 'multi-tenant'],
    title: 'Tenants (MG / CG / Loopc)',
    body: [
      'Each company has isolated data and URL:',
      '- **mg.loopcstrategies.com** — MG tenant',
      '- **cg.loopcstrategies.com** — CG tenant',
      '- **loopc.loopcstrategies.com** — Loopc tenant',
      '',
      'MT4 EA **Tenant** input must match the site you are logged into.',
      'Users, vouchers, inventory — all scoped per tenant DB.',
    ].join('\n'),
  },
  {
    id: 'finance',
    keys: ['finance tab', 'budget', 'expense', 'invoice', 'tax'],
    title: 'Finance Module',
    body: [
      '**Finance tab** — budgets, expenses, invoices, tax records (tenant-specific).',
      'Complements ERP accounting; some tenants use Finance for operational tracking.',
      'Ask **"analyze my company"** for a cross-module snapshot.',
    ].join('\n'),
  },
  {
    id: 'operations',
    keys: ['operations', 'production', 'work order', 'procurement', 'purchase order'],
    title: 'Operations & Production',
    body: [
      '**Operations** — procurement, purchase orders, supplier docs.',
      '**Production** — work orders, WIP tracking, links to inventory.',
      'Metal-heavy workflows tie into ERP vouchers and live spot prices.',
    ].join('\n'),
  },
  {
    id: 'compliance',
    keys: ['compliance', 'audit', 'regulatory', 'kyc', 'vendor compliance'],
    title: 'Compliance',
    body: [
      '**Compliance tab** — regulatory tracking, vendor KYC status, document expiry.',
      'Vendor compliance docs live under ERP → Vendors as well.',
      'Expired docs may block vendor approval workflow.',
    ].join('\n'),
  },
  {
    id: 'training',
    keys: ['training', 'course', 'onboarding', 'learn'],
    title: 'Training',
    body: [
      '**Training tab** — courses, assignments, completion tracking.',
      'Use LoopC anytime for **how-to** questions on ERP, MT4, vouchers, etc.',
    ].join('\n'),
  },
  {
    id: 'navigation',
    keys: ['where is', 'how do i find', 'open', 'navigate to', 'go to', 'which tab'],
    title: 'Navigation',
    body: null, // handled dynamically
  },
]

const FIX_PLAYBOOKS = [
  {
    id: 'mt4-prices',
    match: (text, err) => /mt4|bridge|price|gold|silver|platinum|waiting|ticker|top bar|live feed/i.test(text)
      || (err && /metal|bridge|mt4/i.test(`${err.url} ${err.message}`)),
    steps: [
      'Confirm MT4 is logged in (not "Invalid account").',
      'AutoTrading must be green ON.',
      'EA **EquitiMetalPriceBridge** on chart with smiley face.',
      'Inputs: BridgeUrl, BridgeToken, Tenant=your company, symbols XAUUSD.pr / XAGUSD.pr / XPTUSD.pr.',
      'Experts tab must show: "posted Gold/Silver/Platinum ticks".',
      'Hard refresh dashboard (Ctrl+F5). Top bar should show USD/OZ · MT4.',
    ],
  },
  {
    id: 'session',
    match: (text, err) => /login|session|401|expired|sign in|logged out/i.test(text) || err?.status === 401,
    steps: [
      'Sign out completely, then sign in again.',
      'Use the correct tenant URL (mg/cg/loopc).',
      'Clear site cookies if login loops.',
      'Contact admin if password was reset.',
    ],
  },
  {
    id: 'permission',
    match: (text, err) => /403|forbidden|permission|access denied|not allowed/i.test(text) || err?.status === 403,
    steps: [
      'Your role may be read-only for this module.',
      'Ask Super Admin to review **Admin → Users → permissions**.',
      'ERP permissions are granular: vouchers, ledger, inventory, reports, vendors.',
      'Retry after permissions update (refresh page).',
    ],
  },
  {
    id: 'csrf',
    match: (text, err) => /csrf/i.test(text) || /csrf/i.test(err?.message || ''),
    steps: [
      'Hard refresh the page (Ctrl+F5) to renew CSRF token.',
      'Sign out and sign in if refresh fails.',
      'Ensure cookies are enabled for loopcstrategies.com.',
    ],
  },
  {
    id: 'server',
    match: (text, err) => /500|502|503|504|server error|backend/i.test(text) || (err?.status >= 500),
    steps: [
      'Wait 30 seconds and retry — may be a brief deploy or restart.',
      'Check https://api.loopcstrategies.com/api/health',
      'Note exact time + action and contact support if it persists.',
    ],
  },
  {
    id: 'network',
    match: (text, err) => /offline|network|connection|failed to fetch|cors/i.test(text) || (!err?.status && err?.message),
    steps: [
      'Check internet connection.',
      'Confirm API is up: /api/health',
      'Disable VPN/ad-block for api.loopcstrategies.com if requests fail.',
    ],
  },
  {
    id: 'voucher-save',
    match: (text) => /voucher.*(save|post|submit)|save.*voucher/i.test(text),
    steps: [
      'Check all required fields (date, accounts, amounts).',
      'Verify you have **canAccessVouchers** write permission.',
      'If metal voucher — confirm live prices or enter manual rate.',
      'Hard refresh if CSRF error appears.',
      'Check browser console + LoopC **Fix last error** for HTTP code.',
    ],
  },
  {
    id: 'deploy',
    match: (text) => /deploy|vercel|railway|production|staging/i.test(text),
    steps: [
      'Frontend: Vercel — mg/cg/loopc subdomains.',
      'Backend: Railway — api.loopcstrategies.com.',
      'Env vars: JWT_SECRET, tenant Mongo URIs, METAL_RATES_BRIDGE_TOKEN, optional OPENAI_API_KEY.',
      'After deploy, hard refresh (Ctrl+F5) and check /api/health.',
    ],
  },
]

const INTENT_PATTERNS = [
  { id: 'fix', patterns: [/fix|error|403|401|500|failed|broken|not work|bug|problem|issue|diagnose|troubleshoot|why.*(fail|error)/i], weight: 3 },
  { id: 'analyze', patterns: [/analy[sz]e|audit|review|health check|project|company|dashboard status|how am i|overview|snapshot|report on|assessment|full report/i], weight: 3 },
  { id: 'market', patterns: [/gold|silver|platinum|metal|market|price|mt4|xau|xag|xpt|spot|ounce|oz/i], weight: 2 },
  { id: 'inventory', patterns: [/inventory|stock|warehouse|low stock|raw material|wip|finished good/i], weight: 2 },
  { id: 'sales', patterns: [/sales|pipeline|deal|crm|revenue|lead|contact|win rate|follow.?up/i], weight: 2 },
  { id: 'finance', patterns: [/finance|budget|expense|invoice|cash flow|bank balance|trial balance/i], weight: 2 },
  { id: 'hr', patterns: [/hr|employee|attendance|leave|payroll|staff|headcount/i], weight: 2 },
  { id: 'alerts', patterns: [/alert|task|overdue|notification|remind|todo|pending/i], weight: 2 },
  { id: 'summary', patterns: [/summary|today|status|brief|quick update|what'?s new/i], weight: 2 },
  { id: 'help', patterns: [/how|what|where|help|explain|guide|tutorial|software|erp|voucher|ledger|permission|can you|what can you/i], weight: 1 },
  { id: 'navigate', patterns: [/where is|how do i find|open|navigate|go to|which tab|take me to/i], weight: 2 },
  { id: 'compare', patterns: [/compare|vs|versus|difference between/i], weight: 2 },
  { id: 'capabilities', patterns: [/what can you do|capabilities|features|who are you|about loopc/i], weight: 3 },
]

function scoreTextAgainstPatterns(text, patterns) {
  let score = 0
  for (const re of patterns) {
    if (re.test(text)) score += 1
  }
  return score
}

function scoreKnowledgeMatch(text, keys) {
  const lower = text.toLowerCase()
  let score = 0
  for (const key of keys) {
    if (lower.includes(key.toLowerCase())) score += key.split(' ').length
  }
  return score
}

function matchKnowledge(message = '') {
  const text = String(message || '')
  let best = null
  let bestScore = 0
  for (const guide of MODULE_GUIDES) {
    const s = scoreKnowledgeMatch(text, guide.keys)
    if (s > bestScore) {
      bestScore = s
      best = guide
    }
  }
  return bestScore >= 1 ? best : null
}

function matchFixPlaybooks(message = '', lastError = null) {
  const text = String(message || '')
  return FIX_PLAYBOOKS.filter((pb) => pb.match(text, lastError))
}

function detectBuiltinIntent(message = '', history = []) {
  const text = String(message || '')
  const lower = text.toLowerCase().trim()
  const recent = history.slice(-6).map((m) => m.content).join(' ')

  if (/^(yes|yeah|yep|more|continue|tell me more|go on|what else|and then|ok go|proceed)/i.test(lower)) {
    const prevUser = [...history].reverse().find((m) => m.role === 'user' && m.content !== text)
    if (prevUser) return detectBuiltinIntent(prevUser.content, history.slice(0, -2))
  }

  const scores = {}
  for (const intent of INTENT_PATTERNS) {
    const direct = scoreTextAgainstPatterns(text, intent.patterns) * intent.weight
    const context = scoreTextAgainstPatterns(recent, intent.patterns) * intent.weight * 0.4
    scores[intent.id] = direct + context
  }

  let top = 'general'
  let topScore = 0
  for (const [id, score] of Object.entries(scores)) {
    if (score > topScore) {
      topScore = score
      top = id
    }
  }
  return topScore >= 1 ? top : 'general'
}

const TAB_MAP = [
  { keys: ['voucher'], tab: 'ERP → Vouchers' },
  { keys: ['ledger', 'journal'], tab: 'ERP → Ledger' },
  { keys: ['inventory', 'stock'], tab: 'ERP → Inventory' },
  { keys: ['vendor', 'supplier'], tab: 'ERP → Vendors' },
  { keys: ['report', 'trial balance', 'p&l'], tab: 'ERP → Reports' },
  { keys: ['crm', 'lead', 'deal', 'contact'], tab: 'CRM' },
  { keys: ['hr', 'employee', 'attendance'], tab: 'HR' },
  { keys: ['finance', 'budget', 'expense'], tab: 'Finance' },
  { keys: ['compliance'], tab: 'Compliance' },
  { keys: ['training', 'course'], tab: 'Training' },
  { keys: ['production', 'work order'], tab: 'Production' },
  { keys: ['operations', 'procurement'], tab: 'Operations' },
  { keys: ['admin', 'user management'], tab: 'Admin → Users' },
  { keys: ['task'], tab: 'Overview → Tasks' },
]

function resolveNavigation(message = '') {
  const lower = String(message || '').toLowerCase()
  for (const entry of TAB_MAP) {
    if (entry.keys.some((k) => lower.includes(k))) return entry.tab
  }
  return null
}

module.exports = {
  MODULE_GUIDES,
  FIX_PLAYBOOKS,
  INTENT_PATTERNS,
  matchKnowledge,
  matchFixPlaybooks,
  detectBuiltinIntent,
  resolveNavigation,
  scoreKnowledgeMatch,
}
