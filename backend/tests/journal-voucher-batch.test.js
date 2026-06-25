const request = require('supertest')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')

const createApp = require('../app')
const ChartOfAccount = require('../models/ChartOfAccount')
const Currency = require('../models/Currency')
const Ledger = require('../models/Ledger')
const User = require('../models/User')

let mongo
let app

const TEST_TENANT = 'loopc'
const tokenFor = (user) => jwt.sign({ id: user._id.toString(), company: TEST_TENANT }, process.env.JWT_SECRET)
const authHeader = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` })

const createUser = async (overrides = {}) => {
  const now = Date.now().toString(36)
  return User.create({
    name: `jv-batch-${now}`,
    email: `jv-batch-${now}@example.com`,
    password: 'password123',
    role: 'department_head',
    department: 'finance',
    ...overrides,
  })
}

const seedUsd = async () => {
  await Currency.create({
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    exchangeRate: 1,
    baseCurrency: true,
    isActive: true,
  })
}

const createPairAccounts = async (user) => {
  const debit = await ChartOfAccount.create({
    accountName: 'JV Debit',
    accountCode: '7100',
    accountType: 'Expense',
    createdBy: user._id,
  })
  const credit = await ChartOfAccount.create({
    accountName: 'JV Credit',
    accountCode: '3100',
    accountType: 'Liability',
    createdBy: user._id,
  })
  return { debit, credit }
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.RATE_LIMIT_MAX = '100000'
  process.env.AUTH_RATE_LIMIT_MAX = '100000'
  process.env.DEFAULT_TENANT = TEST_TENANT

  mongo = await startMongoMemoryServer()
  const mongoUri = mongo.getUri()
  process.env.MONGO_URI = mongoUri
  process.env.MONGO_URI_LOOPC = mongoUri
  process.env.MONGO_URI_MG = mongoUri
  process.env.MONGO_URI_CG = mongoUri

  await mongoose.connect(mongoUri)
  app = createApp()
})

afterEach(async () => {
  if (!isMongooseConnected(mongoose)) return
  await Ledger.deleteMany({})
  await ChartOfAccount.deleteMany({})
  await Currency.deleteMany({})
  await User.deleteMany({})
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('POST /ledger/journal-voucher', () => {
  test('creates multi-line journal voucher with shared referenceId atomically', async () => {
    const user = await createUser()
    await seedUsd()
    const { debit, credit } = await createPairAccounts(user)
    const expense = await ChartOfAccount.create({
      accountName: 'Other Expense',
      accountCode: '7200',
      accountType: 'Expense',
      createdBy: user._id,
    })

    const res = await request(app)
      .post('/api/erp-accounting/ledger/journal-voucher')
      .set(authHeader(user))
      .send({
        mode: 'journal',
        postings: [
          {
            date: '2026-06-24',
            description: 'Jv/2026/0100 — travel',
            notes: 'travel',
            currency: 'USD',
            exchangeRate: 1,
            debitAccountId: String(debit._id),
            creditAccountId: String(credit._id),
            amount: 60,
          },
          {
            date: '2026-06-24',
            description: 'Jv/2026/0100 — travel — supplies',
            notes: 'travel',
            currency: 'USD',
            exchangeRate: 1,
            debitAccountId: String(expense._id),
            creditAccountId: String(credit._id),
            amount: 40,
          },
        ],
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.count).toBe(2)
    expect(res.body.referenceId).toMatch(/^[a-f0-9]{24}$/i)

    const rows = await Ledger.find({
      referenceType: 'journal',
      referenceId: res.body.referenceId,
      isDeleted: { $ne: true },
    })
    expect(rows.length).toBe(2)
    expect(rows.every((r) => String(r.referenceId) === res.body.referenceId)).toBe(true)
  })

  test('returns 409 when voucher number already exists', async () => {
    const user = await createUser()
    await seedUsd()
    const { debit, credit } = await createPairAccounts(user)

    await Ledger.create({
      date: new Date('2026-06-24'),
      debitAccountId: debit._id,
      creditAccountId: credit._id,
      amount: 25,
      description: 'Jv/2026/0200 — existing',
      notes: 'existing',
      referenceType: 'journal',
      referenceId: new mongoose.Types.ObjectId(),
      currency: 'USD',
      exchangeRate: 1,
      createdBy: user._id,
    })

    const res = await request(app)
      .post('/api/erp-accounting/ledger/journal-voucher')
      .set(authHeader(user))
      .send({
        mode: 'journal',
        postings: [{
          date: '2026-06-24',
          description: 'Jv/2026/0200 — retry',
          notes: 'retry',
          currency: 'USD',
          exchangeRate: 1,
          debitAccountId: String(debit._id),
          creditAccountId: String(credit._id),
          amount: 10,
        }],
      })

    expect(res.status).toBe(409)
    expect(res.body.message).toContain('Jv/2026/0200')
    expect(res.body.message).toContain('already exists')
  })

  test('returns legacy duplicate message when existing row has no referenceId', async () => {
    const user = await createUser()
    await seedUsd()
    const { debit, credit } = await createPairAccounts(user)

    await Ledger.create({
      date: new Date('2026-06-24'),
      debitAccountId: debit._id,
      creditAccountId: credit._id,
      amount: 15,
      description: 'Jv/2026/0300 — legacy',
      notes: 'legacy',
      referenceType: 'journal',
      referenceId: null,
      currency: 'USD',
      exchangeRate: 1,
      createdBy: user._id,
    })

    const res = await request(app)
      .post('/api/erp-accounting/ledger/journal-voucher')
      .set(authHeader(user))
      .send({
        mode: 'journal',
        postings: [{
          date: '2026-06-24',
          description: 'Jv/2026/0300 — new batch',
          notes: 'new',
          currency: 'USD',
          exchangeRate: 1,
          debitAccountId: String(debit._id),
          creditAccountId: String(credit._id),
          amount: 5,
        }],
      })

    expect(res.status).toBe(409)
    expect(res.body.message).toContain('legacy entry')
  })

  test('replaces prior lines when replaceEntryIds is provided', async () => {
    const user = await createUser()
    await seedUsd()
    const { debit, credit } = await createPairAccounts(user)

    const oldLine = await Ledger.create({
      date: new Date('2026-06-24'),
      debitAccountId: debit._id,
      creditAccountId: credit._id,
      amount: 50,
      description: 'Jv/2026/0400 — old',
      notes: 'old',
      referenceType: 'journal',
      referenceId: new mongoose.Types.ObjectId(),
      currency: 'USD',
      exchangeRate: 1,
      createdBy: user._id,
    })

    const res = await request(app)
      .post('/api/erp-accounting/ledger/journal-voucher')
      .set(authHeader(user))
      .send({
        mode: 'journal',
        replaceEntryIds: [String(oldLine._id)],
        postings: [{
          date: '2026-06-24',
          description: 'Jv/2026/0400 — updated',
          notes: 'updated',
          currency: 'USD',
          exchangeRate: 1,
          debitAccountId: String(debit._id),
          creditAccountId: String(credit._id),
          amount: 75,
        }],
      })

    expect(res.status).toBe(201)
    expect(res.body.count).toBe(1)

    const refreshedOld = await Ledger.findById(oldLine._id)
    expect(refreshedOld.isDeleted).toBe(true)

    const active = await Ledger.find({
      referenceType: 'journal',
      isDeleted: { $ne: true },
      description: new RegExp('^Jv/2026/0400'),
    })
    expect(active.length).toBe(1)
    expect(Number(active[0].amount)).toBe(75)
  })
})
