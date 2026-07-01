const { routeIntent } = require('../services/salesAi/agent/intentRouter')
const { buildRulesFromFacts } = require('../services/salesAi/agent/rulesEngine')

describe('intentRouter', () => {
  test('routes email-only questions without tavily', () => {
    const intent = routeIntent('Analyze all emails in the company inbox')
    expect(intent.wantsEmail).toBe(true)
    expect(intent.emailOnly).toBe(true)
    expect(intent.skipTavily).toBe(true)
    expect(intent.tools).toContain('email')
  })

  test('routes pipeline questions to crm', () => {
    const intent = routeIntent('Analyze our CRM pipeline')
    expect(intent.wantsCrm).toBe(true)
    expect(intent.tools).toContain('crm')
  })
})

describe('rulesEngine', () => {
  test('builds tier1 for overdue activity and tier2 for sales inbox', () => {
    const { tier1, tier2 } = buildRulesFromFacts({
      overdueActivities: [{
        _id: '507f1f77bcf86cd799439011',
        subject: 'Call back Acme',
        contactName: 'Jane',
        nextAction: { description: 'Call', dueDate: new Date('2020-01-01') },
      }],
      staleDeals: [],
      hotLeads: [],
      salesInboxMessages: [{
        id: 'msg1',
        subject: 'Quote request',
        from: 'buyer@acme.com',
        snippet: 'Please send pricing',
      }],
    })

    expect(tier1.some((a) => a.actionType === 'crm_create_followup')).toBe(true)
    expect(tier2.some((a) => a.actionType === 'email_reply_draft')).toBe(true)
  })
})
