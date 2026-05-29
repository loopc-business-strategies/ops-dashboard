/**
 * Built-in Ops Dashboard agent — no external LLM required.
 * Uses live app context, playbooks, and prompt keyword matching.
 */

const SOFTWARE_FAQ = [
  {
    keys: ['voucher', 'post voucher', 'create voucher'],
    answer: 'Open **ERP → Vouchers**. Choose type (payment, receipt, journal, metal stock, etc.), fill header + lines, attach docs if needed, then Save/Post. Metal lines can pull live spot from the top bar when MT4 or market feed is online.',
  },
  {
    keys: ['ledger', 'trial balance', 'account enquiry'],
    answer: 'Open **ERP → Ledger** for entries and balances. **Reports** tab has trial balance, P&L, and balance sheet. Account enquiry shows party balances and aging.',
  },
  {
    keys: ['permission', '403', 'forbidden', 'cannot save', "can't save"],
    answer: 'HTTP 403 usually means your role lacks write permission. Super Admin can set granular ERP permissions in **Admin → Users**. Check vouchers, ledger, inventory, and reports access separately.',
  },
  {
    keys: ['mt4', 'bridge', 'waiting mt4', 'price not show', 'live price'],
    answer: 'Live prices flow: **Equiti MT4 EA** → `api.loopcstrategies.com` bridge → dashboard top bar. In MT4: AutoTrading ON, BridgeToken set, WebRequest allows `https://api.loopcstrategies.com`, symbols like `XAUUSD.pr`, Tenant=mg (or cg/loopc). Check **Terminal → Experts** for successful posts.',
  },
  {
    keys: ['tenant', 'mg', 'cg', 'loopc', 'wrong company'],
    answer: 'Each company has its own URL: **mg**, **cg**, **loopc** under loopcstrategies.com. Data is isolated per tenant. MT4 EA **Tenant** input must match the site you are logged into.',
  },
  {
    keys: ['inventory', 'stock', 'warehouse'],
    answer: '**ERP → Inventory** shows stock types, movements, and valuations. Live gold/silver/platinum from the top bar can value metal stock when configured.',
  },
]

const FIX_PLAYBOOKS = [
  {
    id: 'mt4-prices',
    match: (text, err) => /mt4|bridge|price|gold|silver|platinum|waiting|ticker|top bar/i.test(text)
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
    match: (text, err) => /login|session|401|expired|sign in/i.test(text) || err?.status === 401,
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
    match: (text, err) => /offline|network|connection|failed to fetch/i.test(text) || (!err?.status && err?.message),
    steps: [
      'Check internet connection.',
      'Confirm API is up: /api/health',
      'Disable VPN/ad-block for api.loopcstrategies.com if requests fail.',
    ],
  },
]

function matchFaq(message = '') {
  const text = String(message || '').toLowerCase()
  for (const item of SOFTWARE_FAQ) {
    if (item.keys.some((k) => text.includes(k))) return item.answer
  }
  return null
}

function matchFixPlaybooks(message = '', lastError = null) {
  const text = String(message || '')
  return FIX_PLAYBOOKS.filter((pb) => pb.match(text, lastError))
}

function formatPlaybookReply(playbooks, lastError, pageContext) {
  const lines = ['**Fix plan**']
  if (lastError?.status) {
    lines.push(`\nCaptured error: HTTP **${lastError.status}** — ${lastError.message || 'Unknown'}`)
    if (lastError.url) lines.push(`Endpoint: \`${lastError.url}\``)
  }
  if (pageContext?.tab) lines.push(`You were on: **${pageContext.tab}** tab`)

  playbooks.forEach((pb, idx) => {
    lines.push(`\n**${idx + 1}. ${pb.id.replace(/-/g, ' ')}**`)
    pb.steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`))
  })

  if (!lastError?.status) {
    lines.push('\nIf this does not help, describe what you clicked and any error text you see.')
  }
  return lines.join('\n')
}

function detectBuiltinIntent(message = '') {
  const text = String(message || '').toLowerCase()
  if (/fix|error|403|401|500|failed|broken|not work|bug|problem|issue|help me|diagnose/.test(text)) return 'fix'
  if (/gold|silver|platinum|metal|market|price|mt4|xau|xag/.test(text)) return 'market'
  if (/inventory|stock|warehouse/.test(text)) return 'inventory'
  if (/sales|pipeline|deal|crm|revenue/.test(text)) return 'sales'
  if (/alert|task|overdue|notification/.test(text)) return 'alerts'
  if (/summary|today|overview|status|snapshot/.test(text)) return 'summary'
  if (/how|what|where|help|software|erp|voucher|ledger|permission|news/.test(text)) return 'help'
  return 'general'
}

function runBuiltinAgent({ message, context }) {
  const intent = detectBuiltinIntent(message)
  const userName = context.user?.name || 'there'
  const tenant = context.tenant || 'your company'
  const metals = context.metals || {}
  const tasks = context.tasks || {}
  const lastError = context.lastError
  const pageContext = context.pageContext || {}

  if (intent === 'fix') {
    const playbooks = matchFixPlaybooks(message, lastError)
    if (playbooks.length > 0) {
      return { reply: formatPlaybookReply(playbooks, lastError, pageContext), intent, mode: 'builtin' }
    }
    if (lastError?.status || lastError?.message) {
      return {
        reply: formatPlaybookReply([{
          id: 'generic',
          steps: [
            'Hard refresh (Ctrl+F5) and retry.',
            'Sign out and back in if session-related.',
            'Copy the error message for your admin.',
          ],
        }], lastError, pageContext),
        intent,
        mode: 'builtin',
      }
    }
    return {
      reply: [
        `Hi ${userName}! I can fix problems from your **prompt** or the **last API error**.`,
        'Try:',
        '1. Reproduce the problem once (so I capture the error).',
        '2. Click **Fix last error** or type what failed (e.g. "voucher save 403" or "MT4 prices not showing").',
        '',
        'Describe: what you clicked, what you expected, and any error text.',
      ].join('\n'),
      intent,
      mode: 'builtin',
    }
  }

  if (intent === 'market') {
    if (metals.error) {
      return {
        reply: `Hi ${userName}! Could not load live prices (${metals.error}). Say **fix MT4 prices** for step-by-step bridge setup.`,
        intent,
        mode: 'builtin',
      }
    }
    const feed = metals.live
      ? (String(metals.feedType).includes('mt4') || metals.feedType === 'mt4-bridge' ? 'MT4 live' : 'server market feed')
      : 'offline'
    return {
      reply: [
        `**Live metal prices (${String(tenant).toUpperCase()})**`,
        `- Gold: **${metals.gold ? metals.gold.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}** ${metals.currency}/${metals.unit}`,
        `- Silver: **${metals.silver ? metals.silver.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}**`,
        `- Platinum: **${metals.platinum ? metals.platinum.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}**`,
        `- Feed: **${feed}**`,
        metals.message ? `- ${metals.message}` : '',
        '\nAsk **fix MT4** if prices are missing.',
      ].filter(Boolean).join('\n'),
      intent,
      mode: 'builtin',
    }
  }

  if (intent === 'alerts' || intent === 'summary') {
    return {
      reply: [
        `Hello ${userName}! **${String(tenant).toUpperCase()} snapshot**`,
        `- Open tasks: **${tasks.openTasks ?? '—'}**`,
        `- Overdue tasks: **${tasks.overdueTasks ?? '—'}**`,
        `- API build: **${(context.build?.commit || 'unknown').slice(0, 7)}**`,
        `- Agent: **LoopC** (ChatGPT can be enabled later on Railway)`,
        '\nAsk about **market prices**, **inventory**, or **fix …** for problems.',
      ].join('\n'),
      intent,
      mode: 'builtin',
    }
  }

  if (intent === 'inventory') {
    return {
      reply: `Hi ${userName}! **Inventory:** open ERP Inventory tab. For live metal valuation, ensure top bar prices are live (MT4 or market feed).`,
      intent,
      mode: 'builtin',
    }
  }

  if (intent === 'sales') {
    return {
      reply: `Hi ${userName}! **Sales / CRM** tab has pipeline, deals, and contacts. Ask for **today summary** for task counts.`,
      intent,
      mode: 'builtin',
    }
  }

  const faqHit = matchFaq(message)
  if (faqHit || intent === 'help') {
    return {
      reply: faqHit || [
        `Hi ${userName}! I am **LoopC**, your built-in assistant for ${String(tenant).toUpperCase()}.`,
        '- **Market** — "gold price", "MT4 status"',
        '- **Fix** — describe the problem or use "fix last error"',
        '- **Software** — vouchers, ledger, permissions, tenants',
        '\nChatGPT can be added later via OPENAI_API_KEY on Railway.',
      ].join('\n'),
      intent: faqHit ? 'help' : intent,
      mode: 'builtin',
    }
  }

  return {
    reply: `Hello ${userName}! Try: **Show today summary**, **Live metal prices**, **Fix last error**, or ask how to use **vouchers / ledger / MT4**.`,
    intent: 'general',
    mode: 'builtin',
  }
}

module.exports = {
  runBuiltinAgent,
  detectBuiltinIntent,
  matchFaq,
  matchFixPlaybooks,
  FIX_PLAYBOOKS,
}
