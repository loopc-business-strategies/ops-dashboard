const { buildEmailAnalysis, formatEmailAnalysisSummary } = require('../services/salesAi/agents/emailAnalysis')

describe('emailAnalysis', () => {
  const messages = [
    { from: 'Sales <sales@acme.com>', subject: 'Quote request', snippet: 'Please send pricing' },
    { from: 'Sales <sales@acme.com>', subject: 'Follow up', snippet: 'Checking in' },
    { from: 'News <news@example.org>', subject: 'Weekly digest', snippet: 'Industry news' },
    { from: 'Buyer <buyer@client.io>', subject: 'Invoice #123', snippet: 'Payment due' },
  ]

  test('buildEmailAnalysis groups senders and flags sales-related messages', () => {
    const analysis = buildEmailAnalysis(messages, { query: 'newer_than:30d' })
    expect(analysis.total).toBe(4)
    expect(analysis.topSenders[0].domain).toBe('acme.com')
    expect(analysis.salesRelatedCount).toBeGreaterThanOrEqual(2)
  })

  test('formatEmailAnalysisSummary includes inbox email and highlights', () => {
    const analysis = buildEmailAnalysis(messages)
    const text = formatEmailAnalysisSummary(analysis, 'business@loopcstrategies.com')
    expect(text).toMatch(/business@loopcstrategies.com/)
    expect(text).toMatch(/Top senders/)
    expect(text).toMatch(/Sales-related/)
  })
})
