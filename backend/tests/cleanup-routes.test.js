const express = require('express')
const request = require('supertest')

let mockDb

class MockObjectId {
  constructor(value = Math.random().toString(16).slice(2)) {
    this.value = value
  }

  toString() {
    return this.value
  }
}

jest.mock('mongoose', () => ({
  connection: {
    get db() {
      return mockDb
    },
  },
  Types: {
    ObjectId: MockObjectId,
  },
}))

jest.mock('../middleware/auth', () => ({
  protect: (req, _res, next) => {
    req.user = { _id: new MockObjectId('user-1'), role: 'super_admin' }
    next()
  },
  restrictTo: () => (_req, _res, next) => next(),
}))

function makeCursor(rows) {
  return {
    toArray: async () => rows,
    limit: () => makeCursor(rows),
  }
}

function createMockDb({ cashAccount = null, ledgerEntries = [] } = {}) {
  return {
    collection(name) {
      if (name === 'chartofaccounts') {
        return {
          findOne: async (query) => (
            cashAccount && query.accountCode === cashAccount.accountCode ? cashAccount : null
          ),
        }
      }

      if (name === 'ledgers') {
        return {
          find(query) {
            if (query.description instanceof RegExp) {
              return makeCursor(ledgerEntries.filter((entry) => (
                entry.isDeleted !== true &&
                query.description.test(entry.description || '') &&
                (String(entry.debitAccountId) === String(cashAccount?._id) || String(entry.creditAccountId) === String(cashAccount?._id))
              )))
            }

            const rows = ledgerEntries.filter((entry) => (
              entry.referenceType === 'journal' &&
              entry.isDeleted !== true &&
              (String(entry.debitAccountId) === String(cashAccount?._id) || String(entry.creditAccountId) === String(cashAccount?._id)) &&
              (
                [5954.65, 85.95, 8.26].includes(Number(entry.amount)) ||
                /Exchange/i.test(entry.description || '')
              )
            ))
            return makeCursor(rows)
          },
          updateMany: async (query, update) => {
            const ids = new Set((query._id?.$in || []).map((id) => String(id)))
            let modifiedCount = 0
            for (const entry of ledgerEntries) {
              if (!ids.has(String(entry._id))) continue
              Object.assign(entry, update.$set || {})
              modifiedCount += 1
            }
            return { modifiedCount }
          },
        }
      }

      throw new Error(`Unexpected collection ${name}`)
    },
  }
}

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/admin', require('../routes/cleanupRoutes'))
  return app
}

let app

beforeEach(() => {
  jest.resetModules()
  app = createApp()
  process.env.NODE_ENV = 'test'
  delete process.env.ENABLE_ADMIN_CLEANUP_API
  delete process.env.CLEANUP_CONFIRM_TOKEN
  mockDb = createMockDb()
})

afterEach(() => {
  process.env.NODE_ENV = 'test'
  delete process.env.ENABLE_ADMIN_CLEANUP_API
  delete process.env.CLEANUP_CONFIRM_TOKEN
})

describe('admin cleanup routes', () => {
  test('blocks cleanup API in production unless explicitly enabled', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ENABLE_ADMIN_CLEANUP_API = 'false'

    const res = await request(app)
      .post('/api/admin/cleanup/exchange-entries')
      .send({})

    expect(res.status).toBe(403)
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/disabled in production/i)
  })

  test('requires confirmation token when configured', async () => {
    process.env.CLEANUP_CONFIRM_TOKEN = 'confirm-cleanup'

    const res = await request(app)
      .post('/api/admin/cleanup/exchange-entries')
      .send({})

    expect(res.status).toBe(403)
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/confirmation token/i)
  })

  test('soft deletes matching exchange ledger entries only after safeguards pass', async () => {
    process.env.CLEANUP_CONFIRM_TOKEN = 'confirm-cleanup'

    const cashAccount = {
      _id: new MockObjectId('cash-1000'),
      accountCode: '1000',
      accountName: 'Cash',
    }
    const exchangeEntry = {
      _id: new MockObjectId('exchange-1'),
      referenceType: 'journal',
      description: 'Exchange loss adjustment',
      amount: 85.95,
      date: new Date('2026-05-06'),
      debitAccountId: cashAccount._id,
      creditAccountId: new MockObjectId('other-1'),
      isDeleted: false,
    }
    const ordinaryEntry = {
      _id: new MockObjectId('ordinary-1'),
      referenceType: 'journal',
      description: 'Normal cash entry',
      amount: 10,
      date: new Date('2026-05-06'),
      debitAccountId: cashAccount._id,
      creditAccountId: new MockObjectId('other-2'),
      isDeleted: false,
    }

    mockDb = createMockDb({
      cashAccount,
      ledgerEntries: [exchangeEntry, ordinaryEntry],
    })

    const res = await request(app)
      .post('/api/admin/cleanup/exchange-entries')
      .set('x-cleanup-token', 'confirm-cleanup')
      .send({})

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.deletedCount).toBe(1)
    expect(res.body.entries).toHaveLength(1)
    expect(res.body.entries[0].id).toBe('exchange-1')
    expect(exchangeEntry.isDeleted).toBe(true)
    expect(ordinaryEntry.isDeleted).toBe(false)
  })
})
