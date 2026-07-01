jest.mock('../services/salesAi/crmSnapshot', () => ({
  buildCrmSnapshot: jest.fn(),
}))

jest.mock('../services/salesAi/metalRatesSnapshot', () => ({
  buildMetalRatesSnapshot: jest.fn(),
}))

jest.mock('../services/salesAi/tavilySearch', () => ({
  tavilySearch: jest.fn(),
}))

const { buildCrmSnapshot } = require('../services/salesAi/crmSnapshot')
const { buildMetalRatesSnapshot } = require('../services/salesAi/metalRatesSnapshot')
const { tavilySearch } = require('../services/salesAi/tavilySearch')
const {
  buildSalesAiBriefing,
  fetchMarketBriefing,
  clearBriefingMarketCacheForTests,
  BRIEFING_MARKET_QUERY,
} = require('../services/salesAi/salesAiBriefing')

describe('salesAiBriefing', () => {
  const user = { name: 'Nan', company: 'loopc' }

  const crmSnapshot = {
    accessLevel: 'full',
    summary: {
      pipelineValueUSD: 120000,
      activeLeads: 5,
      hotLeads: 2,
      winRate: 35,
      overdueFollowups: 1,
      totalContacts: 20,
      revenueThisMonthUSD: 8000,
    },
    detail: {
      topOpenDeals: [{ title: 'Acme Gold', stage: 'Proposal', valueUSD: 50000 }],
      recentLeads: [{ title: 'Beta Lead', temperature: 'Hot', companyName: 'Beta Co' }],
    },
  }

  const metalRates = {
    goldPrice: 2350,
    silverPrice: 28,
    priceCurrency: 'USD',
    priceUnit: 'G',
    source: 'feed',
    updatedAt: new Date('2026-06-30T10:00:00Z'),
  }

  beforeEach(() => {
    clearBriefingMarketCacheForTests()
    tavilySearch.mockClear()
    buildCrmSnapshot.mockResolvedValue(crmSnapshot)
    buildMetalRatesSnapshot.mockResolvedValue(metalRates)
    tavilySearch.mockResolvedValue({
      answer: 'Gold jewelry demand in the UAE is rising. Wholesale margins remain tight in Central Asia.',
      results: [{ title: 'Gold outlook 2026', url: 'https://example.com/gold', content: 'Demand is up.' }],
    })
  })

  test('buildSalesAiBriefing returns metals, crm, market, and suggestions', async () => {
    const briefing = await buildSalesAiBriefing(user)

    expect(briefing.generatedAt).toBeTruthy()
    expect(briefing.metals.goldPrice).toBe(2350)
    expect(briefing.crm.summary.pipelineValueUSD).toBe(120000)
    expect(briefing.crm.highlight.topDeal.title).toBe('Acme Gold')
    expect(briefing.market.bullets.length).toBeGreaterThan(0)
    expect(briefing.market.source.url).toBe('https://example.com/gold')
    expect(briefing.suggestions.length).toBeLessThanOrEqual(3)
    expect(briefing.suggestions.some((s) => /hot lead/i.test(s))).toBe(true)
  })

  test('fetchMarketBriefing caches Tavily results per tenant', async () => {
    const first = await fetchMarketBriefing('loopc')
    const second = await fetchMarketBriefing('loopc')

    expect(tavilySearch).toHaveBeenCalledTimes(1)
    expect(tavilySearch).toHaveBeenCalledWith(BRIEFING_MARKET_QUERY, { maxResults: 3, includeAnswer: true })
    expect(first.fromCache).toBe(false)
    expect(second.fromCache).toBe(true)
    expect(second.bullets[0]).toMatch(/UAE/)
  })

  test('returns null market when Tavily is unavailable', async () => {
    tavilySearch.mockResolvedValue({
      results: [],
      error: 'TAVILY_API_KEY is not configured on the server.',
    })

    const market = await fetchMarketBriefing('loopc')
    expect(market).toBeNull()
  })

  test('buildSalesAiBriefing works without market data', async () => {
    tavilySearch.mockResolvedValue({
      results: [],
      error: 'TAVILY_API_KEY is not configured on the server.',
    })

    const briefing = await buildSalesAiBriefing(user)
    expect(briefing.market).toBeNull()
    expect(briefing.metals.silverPrice).toBe(28)
    expect(briefing.suggestions.length).toBeGreaterThan(0)
  })
})
