/**
 * LoopC Project Brain — codebase map, endpoint routing, prompt-based fix resolver.
 * Loads scanned index + curated fix recipes so built-in LoopC "knows" the project.
 */

const fs = require('fs')
const path = require('path')

const INDEX_PATH = path.join(__dirname, '..', 'data', 'loopc-project-index.json')

const ROUTE_PREFIX_MAP = [
  { prefix: '/api/erp-accounting/transactions', file: 'backend/routes/erp-accounting/transactionRoutes.js', service: 'backend/services/erpAccounting/transactionWorkflowService.js', tab: 'ERP → Vouchers' },
  { prefix: '/api/erp-accounting/ledger', file: 'backend/routes/erp-accounting/ledgerRoutes.js', service: 'backend/services/erpAccounting/ledgerBalanceService.js', tab: 'ERP → Ledger' },
  { prefix: '/api/erp-accounting/metal-rates', file: 'backend/routes/erp-accounting/currencyRoutes.js', service: 'backend/services/erpAccounting/metalRateBridgeService.js', tab: 'Top bar / ERP Settings' },
  { prefix: '/api/erp-accounting/vendors', file: 'backend/routes/erp-accounting/vendorRoutes.js', service: 'backend/services/erpAccounting/vendorComplianceService.js', tab: 'ERP → Vendors' },
  { prefix: '/api/erp-accounting/inventory', file: 'backend/routes/erp-accounting/inventoryRoutes.js', service: 'backend/services/erpAccounting/voucherInventoryImpactService.js', tab: 'ERP → Inventory' },
  { prefix: '/api/erp-accounting/reports', file: 'backend/routes/erp-accounting/reportRoutes.js', service: 'backend/services/erpAccounting/reportSummaryService.js', tab: 'ERP → Reports' },
  { prefix: '/api/erp-accounting/accounts', file: 'backend/routes/erp-accounting/accountsRoutes.js', service: 'backend/services/erpAccounting/accountCodeService.js', tab: 'ERP → Chart of Accounts' },
  { prefix: '/api/erp-accounting/customers', file: 'backend/routes/erp-accounting/customerRoutes.js', tab: 'ERP → Customers' },
  { prefix: '/api/erp-accounting/direct-deals', file: 'backend/routes/erp-accounting/directDealsRoutes.js', service: 'backend/services/erpAccounting/erpAccountingDirectDealAndExchangeService.js', tab: 'ERP → Direct Deals' },
  { prefix: '/api/auth', file: 'backend/routes/auth.js', service: 'backend/middleware/auth.js', tab: 'Login / Admin → Users' },
  { prefix: '/api/crm', file: 'backend/routes/crm.js', tab: 'CRM / Sales' },
  { prefix: '/api/projects', file: 'backend/routes/tasks.js', tab: 'Overview → Projects' },
  { prefix: '/api/ai', file: 'backend/routes/ai.js', service: 'backend/services/aiAgentService.js', tab: 'LoopC widget' },
  { prefix: '/api/erp/inventory', file: 'backend/routes/erp.js', tab: 'Operations → Inventory' },
]

const CODE_FIX_RECIPES = [
  {
    id: 'mt4-live-prices',
    scoreKeys: ['mt4', 'bridge', 'waiting mt4', 'live price', 'top bar', 'metal rate', 'xau', 'xauusd', 'gold price missing'],
    errorMatch: /metal-rates|bridge|mt4/i,
    files: [
      'tools/mt4-price-bridge/EquitiMetalPriceBridge.mq4',
      'backend/routes/erp-accounting/currencyRoutes.js',
      'backend/services/erpAccounting/metalRateBridgeService.js',
      'frontend/src/components/TopbarMetalTickers.jsx',
      'frontend/src/hooks/useLiveMetalRates.js',
    ],
    envVars: ['METAL_RATES_BRIDGE_TOKEN', 'SERVER_BASE_URL'],
    userFixes: [
      'MT4: AutoTrading ON, EA on chart, Tenant=mg|cg|loopc, symbols XAUUSD.pr / XAGUSD.pr / XPTUSD.pr',
      'Experts tab must show successful bridge posts',
      'Hard refresh dashboard (Ctrl+F5)',
    ],
    devFixes: [
      'Verify Railway env METAL_RATES_BRIDGE_TOKEN matches MT4 EA BridgeToken input',
      'Check POST /api/erp-accounting/metal-rates/bridge accepts ticks (Railway logs)',
    ],
  },
  {
    id: 'voucher-save-fail',
    scoreKeys: ['voucher', 'transaction', 'save voucher', 'post voucher', 'submit voucher', 'journal'],
    errorMatch: /transactions|voucher|403|400|422/i,
    files: [
      'backend/routes/erp-accounting/transactionRoutes.js',
      'backend/services/erpAccounting/transactionWorkflowService.js',
      'backend/services/erpAccounting/transactionPostingService.js',
      'backend/services/erpAccounting/accessPolicy.js',
      'frontend/src/components/tabs/VoucherTab.jsx',
      'frontend/src/components/tabs/ERPTab.jsx',
    ],
    userFixes: [
      'Check required fields: date, accounts, amounts, party',
      'Confirm ERP write permission for vouchers (Admin → Users)',
      'Hard refresh if CSRF error',
    ],
    devFixes: [
      'Inspect accessPolicy.canAccessVouchers / canCreateTransaction for user role',
      'Check transaction schema validation in backend/routes/erp-accounting/schemas.js',
    ],
  },
  {
    id: 'permission-403',
    scoreKeys: ['403', 'forbidden', 'permission', 'access denied', 'cannot save', "can't save", 'read only'],
    errorMatch: /403|forbidden|permission/i,
    files: [
      'backend/services/erpAccounting/accessPolicy.js',
      'backend/services/permissions/moduleAccessPolicy.js',
      'shared/erp-access-matrix.json',
      'backend/routes/auth.js',
      'frontend/src/components/tabs/AdminTab.jsx',
    ],
    userFixes: [
      'Super Admin → Admin → Users → edit permissions for your role',
      'Refresh page after permission change',
    ],
    devFixes: [
      'Sync shared/erp-access-matrix.json with accessPolicy.js if new ERP actions added',
      'Run backend/tests/erp-access-policy.test.js',
    ],
  },
  {
    id: 'login-session',
    scoreKeys: ['login', 'session', '401', 'expired', 'logout', 'csrf', 'sign in'],
    errorMatch: /401|403|csrf|session|auth/i,
    files: [
      'backend/routes/auth.js',
      'backend/middleware/auth.js',
      'backend/middleware/csrf.js',
      'frontend/src/context/AuthContext.jsx',
      'frontend/src/utils/csrfInterceptor.js',
    ],
    userFixes: [
      'Sign out and sign in on correct tenant URL (mg/cg/loopc)',
      'Hard refresh (Ctrl+F5) to renew CSRF token',
      'Clear cookies for loopcstrategies.com if login loops',
    ],
    devFixes: [
      'Verify JWT_SECRET and COOKIE settings on Railway',
      'Check tenant JWT company matches x-tenant header',
    ],
  },
  {
    id: 'tenant-wrong-data',
    scoreKeys: ['wrong company', 'wrong tenant', 'mg data', 'cg data', 'isolated', 'multi tenant'],
    files: [
      'backend/config/tenants.js',
      'backend/middleware/tenantContext.js',
      'backend/db/tenantConnections.js',
      'frontend/src/config/tenantBranding.js',
    ],
    userFixes: [
      'Use correct subdomain: mg.loopcstrategies.com / cg / loopc',
      'MT4 EA Tenant input must match logged-in site',
    ],
    devFixes: [
      'Verify MONGO_URI_MG / MONGO_URI_CG / MONGO_URI_LOOPC on Railway',
      'Run backend/tests/tenant-db-isolation.test.js',
    ],
  },
  {
    id: 'crm-pipeline',
    scoreKeys: ['crm', 'pipeline', 'lead', 'deal', 'sales', 'follow up', 'follow-up'],
    files: [
      'backend/routes/crm.js',
      'backend/models/CrmLead.js',
      'backend/models/CrmDeal.js',
      'frontend/src/components/tabs/SalesTab.jsx',
      'frontend/src/api/crm.js',
    ],
    userFixes: ['Open CRM tab → check lead temperature and overdue activities'],
    devFixes: ['CRM access filtered by sales role in backend/routes/crm.js salesOnly helpers'],
  },
  {
    id: 'inventory-stock',
    scoreKeys: ['inventory', 'stock', 'low stock', 'warehouse', 'stock-in', 'stock-out'],
    files: [
      'backend/routes/erp-accounting/inventoryRoutes.js',
      'backend/models/InventoryItem.js',
      'backend/models/StockMovement.js',
      'frontend/src/components/tabs/erp/tabs/ERPInventoryTab.jsx',
    ],
    userFixes: ['ERP → Inventory → check min threshold and stock movements'],
    devFixes: ['Stock ledger: GET /api/erp-accounting/inventory/stock-ledger'],
  },
  {
    id: 'deploy-health',
    scoreKeys: ['deploy', 'railway', 'vercel', '500', '502', '503', 'health', 'server down', 'api down'],
    errorMatch: /500|502|503|504|health/i,
    files: [
      'backend/app.js',
      'backend/services/readiness.js',
      'railway.json',
      'docs/DEPLOY.md',
    ],
    envVars: ['JWT_SECRET', 'MONGO_URI_MG', 'MONGO_URI_CG', 'MONGO_URI_LOOPC', 'SERVER_BASE_URL'],
    userFixes: [
      'Check https://api.loopcstrategies.com/api/health',
      'Wait 30s after deploy, then hard refresh frontend',
    ],
    devFixes: [
      'Railway logs for crash; Vercel for frontend build',
      'GET /api/ready for tenant DB ping status',
    ],
  },
  {
    id: 'loopc-ai',
    scoreKeys: ['loopc', 'ai agent', 'chatgpt', 'openai', 'built-in agent'],
    files: [
      'backend/routes/ai.js',
      'backend/services/aiAgentService.js',
      'backend/services/builtinAgentService.js',
      'backend/services/loopcContextService.js',
      'backend/services/loopcProjectBrain.js',
      'frontend/src/components/AIAgentWidget.jsx',
    ],
    envVars: ['OPENAI_API_KEY', 'AI_MODEL', 'AI_PROVIDER'],
    userFixes: [
      'Use LoopC (built-in) for free live ERP analysis',
      'ChatGPT needs OpenAI billing at platform.openai.com',
    ],
    devFixes: [
      'Rebuild project index: node backend/scripts/build-loopc-project-index.js',
      'Run backend/tests/ai-agent.test.js',
    ],
  },
]

let cachedIndex = null

function loadProjectIndex() {
  if (cachedIndex) return cachedIndex
  try {
    cachedIndex = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'))
  } catch {
    cachedIndex = { stats: {}, routes: [], services: [], models: [], frontendTabs: [], architecture: {} }
  }
  return cachedIndex
}

function scoreRecipe(recipe, text, lastError, pageContext) {
  const lower = String(text || '').toLowerCase()
  let score = 0
  for (const key of recipe.scoreKeys || []) {
    if (lower.includes(key.toLowerCase())) score += key.split(' ').length
  }
  if (recipe.errorMatch && lastError) {
    const blob = `${lastError.url || ''} ${lastError.message || ''} ${lastError.status || ''}`
    if (recipe.errorMatch.test(blob)) score += 5
  }
  if (pageContext?.tab) {
    const tab = String(pageContext.tab).toLowerCase()
    if (recipe.scoreKeys?.some((k) => tab.includes(k.split(' ')[0]))) score += 2
  }
  return score
}

function resolveEndpointOwner(url = '') {
  const pathOnly = String(url || '').replace(/^https?:\/\/[^/]+/i, '').split('?')[0]
  for (const entry of ROUTE_PREFIX_MAP) {
    if (pathOnly.startsWith(entry.prefix)) return entry
  }
  return null
}

function searchProject(query = '', limit = 8) {
  const index = loadProjectIndex()
  const terms = String(query || '').toLowerCase().split(/\s+/).filter((t) => t.length > 2)
  if (!terms.length) return []

  const results = []

  const scoreItem = (text, item, kind) => {
    const lower = String(text || '').toLowerCase()
    let score = 0
    for (const t of terms) if (lower.includes(t)) score += 1
    if (score > 0) results.push({ kind, score, ...item })
  }

  for (const r of index.routes || []) {
    scoreItem(r.file, { file: r.file, detail: `${r.endpoints?.length || 0} endpoints` }, 'route')
    for (const ep of r.endpoints || []) {
      scoreItem(`${r.file} ${ep.method} ${ep.path}`, { file: r.file, endpoint: `${ep.method} ${ep.path}` }, 'endpoint')
    }
  }
  for (const s of index.services || []) scoreItem(`${s.file} ${(s.exports || []).join(' ')}`, { file: s.file, exports: s.exports }, 'service')
  for (const m of index.models || []) scoreItem(m, { file: m }, 'model')
  for (const t of index.frontendTabs || []) scoreItem(t, { file: t }, 'frontend-tab')
  for (const a of index.frontendApi || []) scoreItem(a, { file: a }, 'frontend-api')

  return results.sort((a, b) => b.score - a.score).slice(0, limit)
}

function resolveProjectFixes({ message = '', lastError = null, pageContext = {} }) {
  const scored = CODE_FIX_RECIPES
    .map((r) => ({ recipe: r, score: scoreRecipe(r, message, lastError, pageContext) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  const endpointOwner = lastError?.url ? resolveEndpointOwner(lastError.url) : null
  if (endpointOwner && !scored.some((s) => s.recipe.files?.includes(endpointOwner.file))) {
    scored.unshift({
      score: 6,
      recipe: {
        id: 'endpoint-context',
        scoreKeys: [],
        files: [endpointOwner.file, endpointOwner.service].filter(Boolean),
        userFixes: [`Error hit **${endpointOwner.prefix}** — UI tab: ${endpointOwner.tab || 'unknown'}`],
        devFixes: [`Inspect handler in \`${endpointOwner.file}\``],
      },
    })
  }

  return scored.slice(0, 3).map((x) => x.recipe)
}

function formatProjectFixReply({ message, lastError, pageContext, userName }) {
  const fixes = resolveProjectFixes({ message, lastError, pageContext })
  const endpointOwner = lastError?.url ? resolveEndpointOwner(lastError.url) : null
  const lines = [`**LoopC Project Fix** — hi ${userName || 'there'}!`, '']

  if (lastError?.status) {
    lines.push(`**Captured error:** HTTP ${lastError.status} — ${lastError.message || 'Unknown'}`)
    if (lastError.url) lines.push(`**Endpoint:** \`${lastError.url}\``)
    if (endpointOwner) {
      lines.push(`**Code owner:** \`${endpointOwner.file}\`${endpointOwner.service ? ` → \`${endpointOwner.service}\`` : ''}`)
      lines.push(`**UI area:** ${endpointOwner.tab}`)
    }
    lines.push('')
  }

  if (!fixes.length) {
    lines.push('I could not match this to a known code path yet. Try:')
    lines.push('- Describe what you clicked + exact error text')
    lines.push('- Say **analyze project code** to see the full map')
    lines.push('- Or **search code voucher** / **search code mt4**')
    return lines.join('\n')
  }

  fixes.forEach((fix, idx) => {
    lines.push(`## Fix ${idx + 1}: ${fix.id.replace(/-/g, ' ')}`)
    if (fix.files?.length) {
      lines.push('**Project files involved:**')
      fix.files.forEach((f) => lines.push(`- \`${f}\``))
    }
    if (fix.envVars?.length) lines.push(`**Env vars:** ${fix.envVars.map((v) => `\`${v}\``).join(', ')}`)
    if (fix.userFixes?.length) {
      lines.push('\n**Fix now (no code deploy):**')
      fix.userFixes.forEach((s, i) => lines.push(`${i + 1}. ${s}`))
    }
    if (fix.devFixes?.length) {
      lines.push('\n**Developer / deploy fix:**')
      fix.devFixes.forEach((s, i) => lines.push(`${i + 1}. ${s}`))
    }
    lines.push('')
  })

  lines.push('_LoopC knows this project structure — ask follow-ups like "show voucher code path" or "what file handles MT4 bridge?"_')
  return lines.join('\n')
}

function buildProjectStructureReply() {
  const index = loadProjectIndex()
  const arch = index.architecture || {}
  const indexed = index.generatedAt ? new Date(index.generatedAt).toLocaleString() : 'recently'

  return [
    '# Project code map',
    `Full **ops-dashboard** structure — indexed ${indexed}.`,
    '',
    '## Platform',
    `- **Stack:** ${arch.stack || 'Express + MongoDB + React'}`,
    `- **Tenants:** ${(arch.tenants || ['mg', 'cg', 'loopc']).join(', ')}`,
    `- **API:** ${arch.apiBase || 'api.loopcstrategies.com'}`,
    '',
    '## Codebase',
    '| Layer | Files |',
    '|-------|------:|',
    `| Routes | ${index.stats?.routeFiles ?? '—'} |`,
    `| Services | ${index.stats?.serviceFiles ?? '—'} |`,
    `| Models | ${index.stats?.modelFiles ?? '—'} |`,
    `| UI tabs | ${index.stats?.tabFiles ?? '—'} |`,
    '',
    '## Main entry points',
    `- **App server:** \`${arch.keyPaths?.app || 'backend/app.js'}\``,
    `- **Auth:** \`${arch.keyPaths?.auth || 'backend/middleware/auth.js'}\``,
    `- **ERP access:** \`${arch.keyPaths?.erpAccess || 'backend/services/erpAccounting/accessPolicy.js'}\``,
    `- **LoopC AI:** \`${arch.keyPaths?.loopcAi || 'backend/services/builtinAgentService.js'}\``,
    `- **Dashboard UI:** \`${arch.keyPaths?.dashboard || 'frontend/src/pages/Dashboard.jsx'}\``,
    `- **MT4 bridge:** \`${arch.keyPaths?.mt4Bridge || 'tools/mt4-price-bridge/EquitiMetalPriceBridge.mq4'}\``,
    '',
    '## Core API areas',
    '| API | Code file |',
    '|-----|-----------|',
    ...ROUTE_PREFIX_MAP.slice(0, 8).map((e) => `| \`${e.prefix}\` | \`${e.file}\` |`),
    '',
    '**Ask next:** "search code voucher", "fix MT4 prices", or **Analyze my company** for live business data.',
  ].join('\n')
}

function buildCodeSearchReply(query) {
  const hits = searchProject(query, 10)
  if (!hits.length) {
    return `No code matches for **"${query}"**. Try: voucher, mt4, ledger, crm, auth, inventory, loopc, transaction.`
  }
  const lines = [`**Code search:** "${query}"`, '']
  for (const h of hits) {
    if (h.endpoint) lines.push(`- \`${h.endpoint}\` in \`${h.file}\``)
    else if (h.exports?.length) lines.push(`- **service** \`${h.file}\` exports: ${h.exports.slice(0, 5).join(', ')}`)
    else lines.push(`- **${h.kind}** \`${h.file}\`${h.detail ? ` (${h.detail})` : ''}`)
  }
  lines.push('\nAsk **fix …** with your error for automatic fix steps tied to these files.')
  return lines.join('\n')
}

function getProjectBrainSummary() {
  const index = loadProjectIndex()
  return {
    indexedAt: index.generatedAt,
    stats: index.stats,
    recipeCount: CODE_FIX_RECIPES.length,
    routeMapCount: ROUTE_PREFIX_MAP.length,
  }
}

module.exports = {
  loadProjectIndex,
  searchProject,
  resolveEndpointOwner,
  resolveProjectFixes,
  formatProjectFixReply,
  buildProjectStructureReply,
  buildCodeSearchReply,
  getProjectBrainSummary,
  CODE_FIX_RECIPES,
}
