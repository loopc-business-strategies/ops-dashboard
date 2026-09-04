const {
  isVoucher24HourLockFeatureEnabled,
  DEFAULT_ENABLED_TENANTS,
} = require('../../shared/voucher24HourLock')
const {
  isPast24HourWindow,
  make24hLockedError,
  MS_24H,
} = require('../../services/erpAccounting/voucher24HourLockService')
const { createAccountingPeriodLockService } = require('../../services/erpAccounting/accountingPeriodLockService')

describe('voucher24HourLock feature gate', () => {
  const original = process.env.VOUCHER_24H_LOCK_TENANTS

  afterEach(() => {
    if (original === undefined) delete process.env.VOUCHER_24H_LOCK_TENANTS
    else process.env.VOUCHER_24H_LOCK_TENANTS = original
  })

  test('defaults enable loopc and cg only (MG off)', () => {
    delete process.env.VOUCHER_24H_LOCK_TENANTS
    expect(DEFAULT_ENABLED_TENANTS).toEqual(['loopc', 'cg'])
    expect(isVoucher24HourLockFeatureEnabled('loopc')).toBe(true)
    expect(isVoucher24HourLockFeatureEnabled('cg')).toBe(true)
    expect(isVoucher24HourLockFeatureEnabled('mg')).toBe(false)
  })

  test('empty env disables all tenants', () => {
    process.env.VOUCHER_24H_LOCK_TENANTS = ''
    expect(isVoucher24HourLockFeatureEnabled('loopc')).toBe(false)
    expect(isVoucher24HourLockFeatureEnabled('cg')).toBe(false)
    expect(isVoucher24HourLockFeatureEnabled('mg')).toBe(false)
  })
})

describe('isPast24HourWindow boundary', () => {
  test('23h59m59s editable; exactly 24h locked; 24h+1s locked', () => {
    const createdAt = new Date('2026-09-04T10:00:00.000Z')
    const createdMs = createdAt.getTime()
    expect(isPast24HourWindow(createdAt, createdMs + MS_24H - 1)).toBe(false)
    expect(isPast24HourWindow(createdAt, createdMs + MS_24H)).toBe(true)
    expect(isPast24HourWindow(createdAt, createdMs + MS_24H + 1)).toBe(true)
  })

  test('make24hLockedError shape', () => {
    const err = make24hLockedError()
    expect(err.status).toBe(409)
    expect(err.code).toBe('ACCOUNTING_ENTRY_24H_LOCKED')
    expect(err.message).toMatch(/24 hours/)
  })
})

describe('assertAccountingEntryEditable 24h + period', () => {
  const originalPeriod = process.env.ACCOUNTING_PERIOD_CLOSING_TENANTS
  const original24h = process.env.VOUCHER_24H_LOCK_TENANTS

  beforeEach(() => {
    process.env.ACCOUNTING_PERIOD_CLOSING_TENANTS = 'loopc,cg,mg'
    process.env.VOUCHER_24H_LOCK_TENANTS = 'loopc,cg'
  })

  afterEach(() => {
    if (originalPeriod === undefined) delete process.env.ACCOUNTING_PERIOD_CLOSING_TENANTS
    else process.env.ACCOUNTING_PERIOD_CLOSING_TENANTS = originalPeriod
    if (original24h === undefined) delete process.env.VOUCHER_24H_LOCK_TENANTS
    else process.env.VOUCHER_24H_LOCK_TENANTS = original24h
  })

  function makeService({ settingEnabled = true, nowMs } = {}) {
    const periods = new Map()
    const keyOf = (doc) => `${doc.periodType}:${doc.financialYear}:${doc.month == null ? 'null' : doc.month}`
    const AccountingPeriod = {
      async findOne(query) {
        for (const doc of periods.values()) {
          if (query.periodType && doc.periodType !== query.periodType) continue
          if (query.financialYear != null && doc.financialYear !== query.financialYear) continue
          if (Object.prototype.hasOwnProperty.call(query, 'month') && doc.month !== query.month) continue
          return {
            ...doc,
            save: async function save() { periods.set(keyOf(this), { ...this }); return this },
          }
        }
        return null
      },
      async create(doc) {
        const row = { _id: `id-${periods.size + 1}`, status: 'OPEN', ...doc }
        periods.set(keyOf(row), row)
        return {
          ...row,
          save: async function save() { periods.set(keyOf(this), { ...this }); return this },
        }
      },
    }
    AccountingPeriod.find = async () => ({
      sort() { return { lean: async () => [...periods.values()] } },
    })

    const clock = { nowMs: nowMs ?? Date.parse('2026-09-05T10:00:00.000Z') }

    const service = createAccountingPeriodLockService({
      AccountingPeriod,
      Transaction: { async countDocuments() { return 0 } },
      Ledger: { async find() { return { select: () => ({ lean: async () => [] }) } } },
      ChartOfAccount: { async countDocuments() { return 0 } },
      getVoucher24HourLockSetting: async (tenant) => {
        if (!isVoucher24HourLockFeatureEnabled(tenant)) return false
        return settingEnabled
      },
      isPast24HourWindow: (createdAt) => isPast24HourWindow(createdAt, clock.nowMs),
      assertVoucher24HourLock: async ({ tenant, createdAt }) => {
        if (!isVoucher24HourLockFeatureEnabled(tenant)) return
        if (!settingEnabled) return
        if (!createdAt) return
        if (isPast24HourWindow(createdAt, clock.nowMs)) {
          throw make24hLockedError()
        }
      },
    })

    return { service, periods, clock }
  }

  test('MG feature off: old createdAt does not throw 24h lock', async () => {
    const { service } = makeService()
    await expect(service.assertAccountingEntryEditable({
      tenant: 'mg',
      date: new Date('2026-09-04T10:00:00.000Z'),
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
    })).resolves.toBeUndefined()
  })

  test('loopc setting ON: locks at exactly 24h', async () => {
    const createdAt = new Date('2026-09-04T10:00:00.000Z')
    const { service, clock } = makeService()

    clock.nowMs = createdAt.getTime() + MS_24H - 1
    await expect(service.assertAccountingEntryEditable({
      tenant: 'loopc',
      date: createdAt,
      createdAt,
    })).resolves.toBeUndefined()

    clock.nowMs = createdAt.getTime() + MS_24H
    await expect(service.assertAccountingEntryEditable({
      tenant: 'loopc',
      date: createdAt,
      createdAt,
    })).rejects.toMatchObject({ code: 'ACCOUNTING_ENTRY_24H_LOCKED', status: 409 })
  })

  test('cg setting ON: locks when age > 24h', async () => {
    const { service } = makeService({
      nowMs: Date.parse('2026-09-06T12:00:00.000Z'),
    })
    await expect(service.assertAccountingEntryEditable({
      tenant: 'cg',
      date: new Date('2026-09-04T10:00:00.000Z'),
      createdAt: new Date('2026-09-04T10:00:00.000Z'),
    })).rejects.toMatchObject({ code: 'ACCOUNTING_ENTRY_24H_LOCKED' })
  })

  test('setting OFF keeps period OPEN editable even if age > 24h', async () => {
    const { service } = makeService({
      settingEnabled: false,
      nowMs: Date.parse('2026-09-10T10:00:00.000Z'),
    })
    await expect(service.assertAccountingEntryEditable({
      tenant: 'cg',
      date: new Date('2026-09-04T10:00:00.000Z'),
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
    })).resolves.toBeUndefined()
  })

  test('period CLOSED still blocks when 24h setting OFF', async () => {
    const { service, periods } = makeService({ settingEnabled: false })
    await service.ensureMonthlyPeriod(2026, 9)
    const monthly = [...periods.values()].find((p) => p.periodType === 'MONTHLY' && p.month === 9)
    monthly.status = 'CLOSED'
    await expect(service.assertAccountingEntryEditable({
      tenant: 'loopc',
      date: new Date('2026-09-04T10:00:00.000Z'),
      createdAt: new Date('2026-09-04T10:00:00.000Z'),
    })).rejects.toMatchObject({ code: 'ACCOUNTING_PERIOD_CLOSED', status: 409 })
  })
})
