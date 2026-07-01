jest.mock('../services/salesAi/tavilySearch', () => ({
  runTavilySearches: jest.fn(async () => ([
    {
      query: 'gold market trends',
      results: [{ title: 'Gold outlook', url: 'https://example.com/gold', content: 'Demand is rising.' }],
    },
  ])),
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
    reply: '## Executive summary\nPipeline looks healthy.',
    sections: [],
    meta: { model: 'gpt-4o-mini' },
  })),
  getModel: jest.fn(() => 'gpt-4o-mini'),
}))

const { runTavilySearches } = require('../services/salesAi/tavilySearch')
const { buildCrmSnapshot } = require('../services/salesAi/crmSnapshot')
const { runStrategyAgent } = require('../services/salesAi/agents/strategyAgent')
const { runSalesAiChat } = require('../services/salesAi/salesAiOrchestrator')

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
    })

    expect(runTavilySearches).toHaveBeenCalled()
    expect(buildCrmSnapshot).toHaveBeenCalled()
    expect(runStrategyAgent).toHaveBeenCalled()
    expect(result.reply).toMatch(/Executive summary/)
    expect(result.sections.some((s) => s.agent === 'marketResearch')).toBe(true)
    expect(result.sections.some((s) => s.agent === 'crmInsight')).toBe(true)
    expect(result.meta.crmAccessLevel).toBe('aggregate')
  })

  test('runSalesAiChat returns configuration message when OpenAI is missing', async () => {
    delete process.env.OPENAI_API_KEY
    const result = await runSalesAiChat({
      user: { company: 'loopc' },
      message: 'Hello',
    })
    expect(result.reply).toMatch(/OPENAI_API_KEY/)
    expect(runStrategyAgent).not.toHaveBeenCalled()
  })

  test('runSalesAiChat rejects empty message', async () => {
    await expect(runSalesAiChat({
      user: { company: 'loopc' },
      message: '   ',
    })).rejects.toThrow(/Message is required/)
  })
})
