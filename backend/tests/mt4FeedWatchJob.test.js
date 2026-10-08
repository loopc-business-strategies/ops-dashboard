jest.mock('../models/MetalRate', () => ({ findOne: jest.fn() }))

const MetalRate = require('../models/MetalRate')
const { resetLocalCoordinationForTests } = require('../utils/sharedCoordination')
const { isGoldMarketClosed, evaluateMt4Feed, checkTenantMt4Feed } = require('../jobs/mt4FeedWatchJob')

const MIN = 60 * 1000
// Thursday 8 Oct 2026, 06:15 UTC: market open.
const THURSDAY = Date.UTC(2026, 9, 8, 6, 15)

function mockLatestFeed(updatedAt) {
  MetalRate.findOne.mockReturnValue({
    sort: () => ({ select: () => ({ lean: async () => (updatedAt ? { updatedAt: new Date(updatedAt) } : null) }) }),
  })
}

describe('mt4FeedWatchJob', () => {
  beforeEach(() => {
    resetLocalCoordinationForTests()
    MetalRate.findOne.mockReset()
  })

  test('gold market hours: weekend and daily break are closed', () => {
    expect(isGoldMarketClosed(new Date(THURSDAY))).toBe(false)
    expect(isGoldMarketClosed(new Date(Date.UTC(2026, 9, 10, 12, 0)))).toBe(true) // Saturday
    expect(isGoldMarketClosed(new Date(Date.UTC(2026, 9, 9, 21, 30)))).toBe(true) // Friday evening
    expect(isGoldMarketClosed(new Date(Date.UTC(2026, 9, 11, 22, 0)))).toBe(true) // Sunday before open
    expect(isGoldMarketClosed(new Date(Date.UTC(2026, 9, 11, 23, 30)))).toBe(false) // Sunday after open
    expect(isGoldMarketClosed(new Date(Date.UTC(2026, 9, 7, 21, 30)))).toBe(true) // Wednesday break
  })

  test('alerts only after the alert window, during market hours, for tenants with a feed', () => {
    const base = { now: THURSDAY, alertAfterMs: 10 * MIN, staleMs: 30000 }
    expect(evaluateMt4Feed({ ...base, feedUpdatedAt: null }).action).toBe('none')
    expect(evaluateMt4Feed({ ...base, feedUpdatedAt: THURSDAY - 5 * MIN }).action).toBe('none')
    expect(evaluateMt4Feed({ ...base, feedUpdatedAt: THURSDAY - 74 * MIN })).toEqual({ action: 'offline', ageMs: 74 * MIN })

    const mondayJustOpened = Date.UTC(2026, 9, 11, 23, 10)
    expect(evaluateMt4Feed({ ...base, now: mondayJustOpened, feedUpdatedAt: Date.UTC(2026, 9, 9, 20, 50) }).action).toBe('none')
    expect(evaluateMt4Feed({ ...base, now: mondayJustOpened + 10 * MIN, feedUpdatedAt: Date.UTC(2026, 9, 9, 20, 50) }).action).toBe('offline')
  })

  test('after an alert, waits for fresh prices before reporting the feed is back', () => {
    const state = { alertedFeedAt: new Date(THURSDAY - 74 * MIN).toISOString() }
    const base = { now: THURSDAY, alertAfterMs: 10 * MIN, staleMs: 30000, state }
    expect(evaluateMt4Feed({ ...base, feedUpdatedAt: THURSDAY - 74 * MIN }).action).toBe('none')
    expect(evaluateMt4Feed({ ...base, feedUpdatedAt: THURSDAY - 5000 })).toEqual({ action: 'online', outageMs: 74 * MIN - 5000 })
  })

  test('sends one offline alert per outage and one back-online message', async () => {
    const notify = jest.fn(async () => ({ sent: 1 }))
    const outageStart = THURSDAY - 74 * MIN
    mockLatestFeed(outageStart)

    await checkTenantMt4Feed('mg', { now: THURSDAY, notify })
    await checkTenantMt4Feed('mg', { now: THURSDAY + MIN, notify })
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith('mg', 'mt4_feed_alert', expect.objectContaining({
      status: 'offline',
      message: expect.stringContaining('No MT4 price for 74 minutes'),
    }))

    mockLatestFeed(THURSDAY + 2 * MIN)
    await checkTenantMt4Feed('mg', { now: THURSDAY + 2 * MIN + 1000, notify })
    await checkTenantMt4Feed('mg', { now: THURSDAY + 3 * MIN, notify })
    expect(notify).toHaveBeenCalledTimes(2)
    expect(notify).toHaveBeenLastCalledWith('mg', 'mt4_feed_alert', expect.objectContaining({
      status: 'online',
      message: 'MT4 prices are back after 76 minutes.',
    }))
  })
})
