const { detectBuiltinIntent, matchFixPlaybooks, runBuiltinAgent } = require('../services/builtinAgentService')
const { matchKnowledge } = require('../services/loopcKnowledgeBase')
const { resolveOpenAiModel, resolveProvider, getAiAgentConfig, formatOpenAiUserMessage } = require('../services/aiAgentService')

const mockSnapshot = {
  user: { name: 'Nan', role: 'super_admin', department: 'finance' },
  tenant: 'mg',
  erp: {
    inventoryItems: 42,
    lowStock: 3,
    vendors: 10,
    customers: 25,
    accounts: 100,
    ledgerEntries: 500,
    vouchers: { draft: 2, posted: 80, pending: 1 },
    recentVouchers: [],
  },
  crm: {
    contacts: 50,
    activeLeads: 12,
    hotLeads: 4,
    totalDeals: 8,
    pipelineValue: 120000,
    winRate: 35,
    overdueFollowups: 2,
  },
  hr: { employees: 15, openTasks: 5 },
  tasks: { open: 5, overdue: 1, recent: [{ title: 'Review vouchers', status: 'open' }] },
  metals: { live: true, gold: 2300, silver: 28, platinum: 950, currency: 'USD', unit: 'TOZ', feedType: 'mt4-bridge' },
  alerts: [{ level: 'warning', text: '1 overdue task(s)' }],
  build: { commit: 'abc1234' },
  pageContext: { tab: 'erp' },
}

describe('builtinAgentService', () => {
  test('detectBuiltinIntent classifies fix, market, analyze, and project prompts', () => {
    expect(detectBuiltinIntent('Fix my MT4 prices')).toBe('fix')
    expect(detectBuiltinIntent('What is the gold price today?')).toBe('market')
    expect(detectBuiltinIntent('Analyze my company')).toBe('analyze')
    expect(detectBuiltinIntent('Analyze my project code structure')).toBe('project')
    expect(detectBuiltinIntent('What can you do?')).toBe('capabilities')
  })

  test('detectBuiltinIntent uses conversation history for follow-ups', () => {
    const history = [
      { role: 'user', content: 'Analyze my company' },
      { role: 'assistant', content: 'Full report...' },
    ]
    expect(detectBuiltinIntent('tell me more', history)).toBe('analyze')
  })

  test('matchFixPlaybooks finds MT4 playbook from prompt text', () => {
    const hits = matchFixPlaybooks('top bar waiting MT4 no prices', null)
    expect(hits.some((h) => h.id === 'mt4-prices')).toBe(true)
  })

  test('runBuiltinAgent returns fix plan for permission prompt', () => {
    const result = runBuiltinAgent({
      message: 'I get 403 forbidden when saving voucher',
      context: { tenant: 'mg', snapshot: mockSnapshot, pageContext: { tab: 'erp' } },
    })
    expect(result.mode).toBe('builtin')
    expect(result.reply).toMatch(/Fix plan|403|permission/i)
  })

  test('runBuiltinAgent returns full company analysis', () => {
    const result = runBuiltinAgent({
      message: 'Analyze my company',
      context: { tenant: 'mg', metals: mockSnapshot.metals, snapshot: mockSnapshot },
    })
    expect(result.intent).toBe('analyze')
    expect(result.reply).toMatch(/Company Analysis/i)
    expect(result.reply).toMatch(/Inventory items.*42/i)
    expect(result.reply).toMatch(/Pipeline.*120/i)
  })

  test('runBuiltinAgent lists capabilities', () => {
    const result = runBuiltinAgent({
      message: 'What can you do?',
      context: { tenant: 'mg', snapshot: mockSnapshot },
    })
    expect(result.intent).toBe('capabilities')
    expect(result.reply).toMatch(/LoopC Pro/i)
    expect(result.reply).toMatch(/Analyze my company/i)
  })
})

describe('loopcKnowledgeBase', () => {
  test('matchKnowledge finds voucher guide', () => {
    const hit = matchKnowledge('how do I post a voucher')
    expect(hit?.id).toBe('vouchers')
  })
})

describe('aiAgentService config', () => {
  test('defaults to builtin provider', () => {
    expect(resolveProvider(null)).toBe('builtin')
    expect(resolveProvider('openai')).toBe('builtin')
  })

  test('resolveOpenAiModel allowlists ChatGPT models', () => {
    expect(resolveOpenAiModel('gpt-4o-mini')).toBe('gpt-4o-mini')
    expect(resolveOpenAiModel('unknown')).toBe('gpt-4o')
  })

  test('getAiAgentConfig exposes builtin as default', () => {
    const cfg = getAiAgentConfig()
    expect(cfg.provider).toBe('builtin')
    expect(cfg.providers[0].id).toBe('builtin')
    expect(cfg.providers[0].available).toBe(true)
    expect(cfg.providers[0].description).toMatch(/LoopC Pro/i)
  })

  test('formatOpenAiUserMessage explains quota errors', () => {
    const msg = formatOpenAiUserMessage(new Error('OpenAI HTTP 429: {"error":{"code":"insufficient_quota","message":"You exceeded your current quota"}}'))
    expect(msg).toMatch(/billing quota/i)
    expect(msg).toMatch(/LoopC \(built-in\)/i)
  })
})
