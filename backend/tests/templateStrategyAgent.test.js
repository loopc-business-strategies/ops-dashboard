const { runTemplateStrategyAgent, buildRecommendations, isOpenAiQuotaError } = require('../services/salesAi/agents/templateStrategyAgent')

describe('templateStrategyAgent', () => {
  const crmSnapshot = {
    accessLevel: 'full',
    summary: {
      pipelineValueUSD: 50000,
      activeLeads: 3,
      hotLeads: 2,
      winRate: 25,
      revenueThisMonthUSD: 12000,
      overdueFollowups: 1,
      totalContacts: 10,
    },
    detail: {
      topOpenDeals: [{ title: 'Acme Gold', stage: 'Proposal', valueUSD: 30000 }],
      recentLeads: [{ title: 'Beta Lead', temperature: 'Hot', companyName: 'Beta Co' }],
    },
  }

  const marketSection = {
    content: 'Market text',
    sources: [{ title: 'Gold outlook', url: 'https://example.com/gold' }],
  }

  test('buildRecommendations surfaces CRM priorities', () => {
    const recs = buildRecommendations(crmSnapshot, marketSection)
    expect(recs.some((r) => /overdue follow-up/i.test(r))).toBe(true)
    expect(recs.some((r) => /hot lead/i.test(r))).toBe(true)
  })

  test('runTemplateStrategyAgent returns markdown briefing', () => {
    const result = runTemplateStrategyAgent({
      userMessage: 'Analyze pipeline',
      marketSection,
      crmSnapshot,
      metalRates: { goldPrice: 2350, silverPrice: 28, priceCurrency: 'USD', priceUnit: 'G', source: 'test' },
      fallbackReason: 'quota',
    })
    expect(result.reply).toMatch(/Executive summary/)
    expect(result.reply).toMatch(/Recommendations/)
    expect(result.meta.synthesisMode).toBe('template')
  })

  test('isOpenAiQuotaError detects quota failures', () => {
    expect(isOpenAiQuotaError(new Error('OpenAI HTTP 429: insufficient_quota'))).toBe(true)
    expect(isOpenAiQuotaError(new Error('network timeout'))).toBe(false)
  })
})
