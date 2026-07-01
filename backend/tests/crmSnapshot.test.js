jest.mock('../models/CrmContact', () => ({
  countDocuments: jest.fn(async () => 5),
}))

jest.mock('../models/CrmLead', () => ({
  countDocuments: jest.fn(async () => 2),
  find: jest.fn(() => ({
    sort: () => ({
      limit: () => ({
        select: () => ({
          lean: async () => [{
            name: 'Beta Lead',
            stage: 'Qualified',
            temperature: 'Hot',
            estValueUSD: 5000,
            companyName: 'Beta Co',
          }],
        }),
      }),
    }),
  })),
}))

jest.mock('../models/CrmDeal', () => ({
  find: jest.fn()
    .mockImplementationOnce(() => ({
      select: () => ({
        lean: async () => [{
          stage: 'Proposal',
          valueUSD: 120000,
          closedWon: null,
        }],
      }),
    }))
    .mockImplementation(() => ({
      sort: () => ({
        limit: () => ({
          select: () => ({
            lean: async () => [{
              name: 'Acme Gold Contract',
              stage: 'Proposal',
              valueUSD: 120000,
              probability: 60,
              expectedCloseDate: new Date(),
            }],
          }),
        }),
      }),
    })),
}))

jest.mock('../models/CrmActivity', () => ({
  countDocuments: jest.fn(async () => 1),
}))

jest.mock('../services/permissions/moduleAccessPolicy', () => ({
  canViewCrm: jest.fn(() => true),
  isSalesRep: jest.fn(() => false),
  isSalesHead: jest.fn(() => false),
}))

const { buildCrmSnapshot } = require('../services/salesAi/crmSnapshot')

describe('crmSnapshot', () => {
  test('maps deal name field to title for display', async () => {
    const snapshot = await buildCrmSnapshot({ name: 'Nan', role: 'super_admin' })
    expect(snapshot.accessLevel).toBe('full')
    expect(snapshot.detail.topOpenDeals[0].title).toBe('Acme Gold Contract')
    expect(snapshot.detail.recentLeads[0].title).toBe('Beta Lead')
    expect(snapshot.detail.recentLeads[0].valueUSD).toBe(5000)
  })
})
