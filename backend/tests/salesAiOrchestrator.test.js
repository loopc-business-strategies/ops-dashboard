jest.mock('../services/salesAi/agents/emailInboxAgent', () => ({
  runEmailInboxAgent: jest.fn(async () => null),
}))

jest.mock('../services/salesAi/tavilySearch', () => ({
  runTavilySearches: jest.fn(async () => ([
    {
      query: 'gold market trends UAE',
      answer: 'UAE gold demand remains strong in wholesale.',
      results: [{ title: 'Gold outlook', url: 'https://example.com/gold', content: 'Demand is rising.' }],
    },
  ])),
  shouldUseAdvancedSearchDepth: jest.fn(() => false),
}))

jest.mock('../services/salesAi/crmSnapshot', () => ({
  buildCrmSnapshot: jest.fn(async () => ({
    accessLevel: 'aggregate',
    summary: {
      pipelineValueUSD: 50000,
      activeLeads: 3,
      hotLeads: 1,
      winRate: 40,
      revenueThisMonthUSD: 12000,
      overdueFollowups: 0,
      totalContacts: 10,
    },
    detail: null,
  })),
}))

jest.mock('../services/salesAi/metalRatesSnapshot', () => ({
  buildMetalRatesSnapshot: jest.fn(async () => ({
    goldPrice: 2350,
    silverPrice: 28,
    platinumPrice: 0,
    priceCurrency: 'USD',
    priceUnit: 'G',
    source: 'test',
    updatedAt: new Date().toISOString(),
  })),
}))

jest.mock('../services/salesAi/agents/strategyAgent', () => ({
  runStrategyAgent: jest.fn(async () => ({
    agent: 'strategy',
    title: 'Recommendations',
    reply: '## Answer\nPipeline looks healthy.',
    sections: [],
    meta: { model: 'gpt-4o-mini' },
  })),
  getModel: jest.fn(() => 'gpt-4o-mini'),
}))

const { runTavilySearches } = require('../services/salesAi/tavilySearch')
const { buildCrmSnapshot } = require('../services/salesAi/crmSnapshot')
const { runStrategyAgent } = require('../services/salesAi/agents/strategyAgent')
const { runEmailInboxAgent } = require('../services/salesAi/agents/emailInboxAgent')
const { runSalesAiChat, getSalesAiConfig } = require('../services/salesAi/salesAiOrchestrator')
const { buildSearchQueries } = require('../services/salesAi/salesAiPrompts')

describe('salesAiOrchestrator', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-openai-key'
    jest.clearAllMocks()
  })

  test('runSalesAiChat orchestrates research, CRM, and strategy synthesis', async () => {
    const result = await runSalesAiChat({
      user: { company: 'loopc', name: 'Test User', role: 'department_user' },
      message: 'What are gold jewelry market trends?',
      history: [],
      pageContext: { tab: 'overview' },
      chatInputs: { region: 'uae', constraints: 'wholesale only' },
    })

    expect(runTavilySearches).toHaveBeenCalled()
    expect(buildCrmSnapshot).toHaveBeenCalled()
    expect(runStrategyAgent).toHaveBeenCalled()
    expect(result.reply).toMatch(/Answer/)
    expect(result.sections.some((s) => s.agent === 'marketResearch')).toBe(true)
    expect(result.sections.some((s) => s.agent === 'crmInsight')).toBe(true)
    expect(result.meta.crmAccessLevel).toBe('aggregate')
    expect(result.meta.chatInputs.region).toBe('uae')
  })

  test('runSalesAiChat returns template answer when OpenAI is missing', async () => {
    delete process.env.OPENAI_API_KEY
    process.env.SALES_AI_SYNTHESIS_MODE = 'auto'
    const result = await runSalesAiChat({
      user: { company: 'loopc' },
      message: 'What is the UAE gold market outlook?',
    })
    expect(result.reply).toMatch(/## Answer/)
    expect(result.meta.synthesisMode).toBe('template')
    expect(runStrategyAgent).not.toHaveBeenCalled()
  })

  test('runSalesAiChat falls back to template on OpenAI quota error', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key'
    process.env.SALES_AI_SYNTHESIS_MODE = 'auto'
    runStrategyAgent.mockRejectedValueOnce(new Error('OpenAI HTTP 429: insufficient_quota'))
    const result = await runSalesAiChat({
      user: { company: 'loopc' },
      message: 'Market trends',
    })
    expect(result.meta.synthesisMode).toBe('template')
    expect(result.reply).toMatch(/Template mode/)
  })

  test('runSalesAiChat rejects empty message', async () => {
    await expect(runSalesAiChat({
      user: { company: 'loopc' },
      message: '   ',
    })).rejects.toThrow(/Message is required/)
  })

  test('runSalesAiChat prompts Gmail connect for email intent without inbox', async () => {
    runEmailInboxAgent.mockResolvedValueOnce({
      agent: 'emailInbox',
      title: 'Inbox',
      connectRequired: true,
      connectUrl: 'https://api.example.com/api/email/oauth/gmail/start',
      content: 'Not connected',
      messages: [],
    })
    const result = await runSalesAiChat({
      user: { company: 'loopc', _id: 'abc' },
      message: 'Check my email',
    })
    expect(result.meta.emailConnectRequired).toBe(true)
    expect(runTavilySearches).not.toHaveBeenCalled()
    expect(result.reply).toMatch(/Connect Gmail/i)
  })

  test('getSalesAiConfig includes check email quick action', () => {
    const config = getSalesAiConfig()
    expect(config.quickActions.some((a) => a.id === 'check-email')).toBe(true)
  })

  test('getSalesAiConfig exposes regions', () => {
    const config = getSalesAiConfig()
    expect(Array.isArray(config.regions)).toBe(true)
    expect(config.regions.some((r) => r.id === 'uae')).toBe(true)
  })

  test('buildSearchQueries includes region suffix', () => {
    const queries = buildSearchQueries('market trends', { region: 'uae' })
    expect(queries.some((q) => /UAE|Dubai/i.test(q))).toBe(true)
  })
})
