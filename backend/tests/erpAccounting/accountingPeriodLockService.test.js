const {
  createAccountingPeriodLockService,
  isAccountingPeriodClosingEnabled,
  periodLabel,
  makePeriodClosedError,
} = require('../../services/erpAccounting/accountingPeriodLockService')

describe('accountingPeriodClosing feature flag', () => {
  const original = process.env.ACCOUNTING_PERIOD_CLOSING_TENANTS

  afterEach(() => {
    if (original === undefined) delete process.env.ACCOUNTING_PERIOD_CLOSING_TENANTS
    else process.env.ACCOUNTING_PERIOD_CLOSING_TENANTS = original
  })

  test('defaults enable loopc and cg, not mg', () => {
    delete process.env.ACCOUNTING_PERIOD_CLOSING_TENANTS
    expect(isAccountingPeriodClosingEnabled('loopc')).toBe(true)
    expect(isAccountingPeriodClosingEnabled('cg')).toBe(true)
    expect(isAccountingPeriodClosingEnabled('mg')).toBe(false)
  })

  test('env override can disable all tenants (MG rollout simulation)', () => {
    process.env.ACCOUNTING_PERIOD_CLOSING_TENANTS = ''
    expect(isAccountingPeriodClosingEnabled('loopc')).toBe(false)
    expect(isAccountingPeriodClosingEnabled('cg')).toBe(false)
    expect(isAccountingPeriodClosingEnabled('mg')).toBe(false)
  })
})

describe('accountingPeriodLockService', () => {
  const original = process.env.ACCOUNTING_PERIOD_CLOSING_TENANTS

  afterEach(() => {
    if (original === undefined) delete process.env.ACCOUNTING_PERIOD_CLOSING_TENANTS
    else process.env.ACCOUNTING_PERIOD_CLOSING_TENANTS = original
  })

  function makeStore() {
    const periods = new Map()
    const keyOf = (doc) => `${doc.periodType}:${doc.financialYear}:${doc.month == null ? 'null' : doc.month}`

    const AccountingPeriod = {
      async findOne(query) {
        for (const doc of periods.values()) {
          if (query.periodType && doc.periodType !== query.periodType) continue
          if (query.financialYear != null && doc.financialYear !== query.financialYear) continue
          if (Object.prototype.hasOwnProperty.call(query, 'month') && doc.month !== query.month) continue
          if (query._id && String(doc._id) !== String(query._id)) continue
          return { ...doc, save: async function save() { periods.set(keyOf(this), { ...this }); return this } }
        }
        return null
      },
      async create(doc) {
        const row = {
          _id: `id-${periods.size + 1}`,
          status: 'OPEN',
          ...doc,
        }
        periods.set(keyOf(row), row)
        return {
          ...row,
          save: async function save() { periods.set(keyOf(this), { ...this }); return this },
        }
      },
      async find(query) {
        const rows = [...periods.values()].filter((doc) => {
          if (query.financialYear != null && doc.financialYear !== query.financialYear) return false
          return true
        })
        return {
          sort: async () => rows,
          lean: async () => rows,
        }
      },
      _periods: periods,
    }

    // Make find().sort().lean() work
    AccountingPeriod.find = async (query) => {
      const rows = [...periods.values()].filter((doc) => {
        if (query.financialYear != null && doc.financialYear !== query.financialYear) return false
        return true
      })
      return {
        sort() {
          return {
            lean: async () => rows,
          }
        },
      }
    }

    const Transaction = {
      async countDocuments() { return 0 },
    }
    const Ledger = {
      async find() {
        return { select: () => ({ lean: async () => [] }) }
      },
    }

    return { AccountingPeriod, Transaction, Ledger, periods }
  }

  test('noop when feature disabled for tenant', async () => {
    process.env.ACCOUNTING_PERIOD_CLOSING_TENANTS = ''
    const store = makeStore()
    const svc = createAccountingPeriodLockService(store)
    await expect(svc.assertAccountingPeriodOpen({
      tenant: 'mg',
      date: new Date(Date.UTC(2026, 0, 15)),
    })).resolves.toBeUndefined()
  })

  test('blocks when monthly period is CLOSED', async () => {
    process.env.ACCOUNTING_PERIOD_CLOSING_TENANTS = 'loopc,cg'
    const store = makeStore()
    const svc = createAccountingPeriodLockService(store)
    const monthly = await svc.ensureMonthlyPeriod(2026, 1)
    monthly.status = 'CLOSED'
    store.periods.set(`MONTHLY:2026:1`, { ...monthly })

    await expect(svc.assertAccountingPeriodOpen({
      tenant: 'loopc',
      date: new Date(Date.UTC(2026, 0, 15)),
    })).rejects.toMatchObject({ code: 'ACCOUNTING_PERIOD_CLOSED', status: 409 })
  })

  test('blocks when yearly period is CLOSED even if month OPEN', async () => {
    process.env.ACCOUNTING_PERIOD_CLOSING_TENANTS = 'loopc'
    const store = makeStore()
    const svc = createAccountingPeriodLockService(store)
    await svc.ensureMonthlyPeriod(2026, 3)
    const yearly = await svc.ensureYearlyPeriod(2026)
    yearly.status = 'CLOSED'
    store.periods.set('YEARLY:2026:null', { ...yearly })

    await expect(svc.assertAccountingPeriodOpen({
      tenant: 'loopc',
      date: new Date(Date.UTC(2026, 2, 10)),
    })).rejects.toMatchObject({ code: 'ACCOUNTING_PERIOD_CLOSED' })
  })

  test('date bypass: both existing and new dates must be open', async () => {
    process.env.ACCOUNTING_PERIOD_CLOSING_TENANTS = 'cg'
    const store = makeStore()
    const svc = createAccountingPeriodLockService(store)
    const jan = await svc.ensureMonthlyPeriod(2026, 1)
    jan.status = 'CLOSED'
    store.periods.set('MONTHLY:2026:1', { ...jan })
    await svc.ensureMonthlyPeriod(2026, 3)

    await expect(svc.assertAccountingPeriodOpen({
      tenant: 'cg',
      existingDate: new Date(Date.UTC(2026, 0, 31)),
      date: new Date(Date.UTC(2026, 2, 1)),
    })).rejects.toMatchObject({ code: 'ACCOUNTING_PERIOD_CLOSED' })

    await expect(svc.assertAccountingPeriodOpen({
      tenant: 'cg',
      existingDate: new Date(Date.UTC(2026, 2, 1)),
      date: new Date(Date.UTC(2026, 0, 31)),
    })).rejects.toMatchObject({ code: 'ACCOUNTING_PERIOD_CLOSED' })
  })

  test('tenant isolation: closed in loopc store does not affect cg when separate service instances', async () => {
    process.env.ACCOUNTING_PERIOD_CLOSING_TENANTS = 'loopc,cg'
    const loopcStore = makeStore()
    const cgStore = makeStore()
    const loopcSvc = createAccountingPeriodLockService(loopcStore)
    const cgSvc = createAccountingPeriodLockService(cgStore)

    const jan = await loopcSvc.ensureMonthlyPeriod(2026, 1)
    jan.status = 'CLOSED'
    loopcStore.periods.set('MONTHLY:2026:1', { ...jan })
    await cgSvc.ensureMonthlyPeriod(2026, 1)

    await expect(loopcSvc.assertAccountingPeriodOpen({
      tenant: 'loopc',
      date: new Date(Date.UTC(2026, 0, 15)),
    })).rejects.toMatchObject({ code: 'ACCOUNTING_PERIOD_CLOSED' })

    await expect(cgSvc.assertAccountingPeriodOpen({
      tenant: 'cg',
      date: new Date(Date.UTC(2026, 0, 15)),
    })).resolves.toBeUndefined()
  })

  test('periodLabel helpers', () => {
    expect(periodLabel('MONTHLY', 2026, 1)).toBe('January 2026')
    expect(periodLabel('YEARLY', 2026, null)).toBe('FY 2026')
    const err = makePeriodClosedError('January 2026')
    expect(err.code).toBe('ACCOUNTING_PERIOD_CLOSED')
    expect(err.status).toBe(409)
  })
})
