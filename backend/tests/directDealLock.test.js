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
const Customer = require('../models/Customer')
const DirectDeal = require('../models/DirectDeal')
const Ledger = require('../models/Ledger')
const User = require('../models/User')
const { diffDirectDeals } = require('../services/erpAccounting/directDealHistory')

let mongo
let app

const TEST_TENANT = 'loopc'
const tokenFor = (user) => jwt.sign({ id: user._id.toString(), company: TEST_TENANT }, process.env.JWT_SECRET)
const authHeader = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` })

const createUser = async (overrides = {}) => {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return User.create({
    name: `deal-lock-${suffix}`,
    email: `deal-lock-${suffix}@example.com`,
    password: 'password123',
    role: 'department_head',
    department: 'finance',
    ...overrides,
  })
}

const createCustomer = async (user) => {
  const res = await request(app)
    .post('/api/erp-accounting/customers')
    .set(authHeader(user))
    .send({ name: 'Lock Test Customer', currency: 'USD' })
  expect(res.status).toBe(201)
  return res.body.customer
}

const createConfirmedDeal = async (user, customer) => {
  const res = await request(app)
    .post('/api/erp-accounting/direct-deals')
    .set(authHeader(user))
    .send({
      entryType: 'fixing',
      currency: 'USD',
      status: 'confirmed',
      lineItems: [{
        customerId: customer._id,
        customerName: customer.name,
        direction: 'buy',
        metal: 'XAU',
        qty: 2,
        price: 2300,
        stockCode: 'OZ',
      }],
    })
  expect(res.status).toBe(201)
  return res.body.deal
}

const activeLedgerRows = (dealId) => Ledger.find({
  referenceType: 'direct_deal',
  referenceId: dealId,
  isDeleted: { $ne: true },
}).lean()

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
  await DirectDeal.deleteMany({})
  await Customer.deleteMany({})
  await ChartOfAccount.deleteMany({})
  await User.deleteMany({})
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('diffDirectDeals', () => {
  test('reports a flipped direction and price per line', () => {
    const before = { currency: 'USD', lineItems: [{ customerId: 'c1', customerName: 'A', direction: 'buy', metal: 'XAU', qty: 1, stockCode: 'OZ', price: 2300 }] }
    const after = { currency: 'USD', lineItems: [{ customerId: 'c1', customerName: 'A', direction: 'sell', metal: 'XAU', qty: 1, stockCode: 'OZ', price: 2310 }] }

    expect(diffDirectDeals(before, after)).toEqual([
      { line: 1, field: 'direction', from: 'buy', to: 'sell' },
      { line: 1, field: 'price', from: '2300', to: '2310' },
    ])
  })

  test('reports added and removed lines and ignores unchanged dates', () => {
    const line = { customerId: 'c1', customerName: 'A', direction: 'buy', metal: 'XAU', qty: 1, stockCode: 'OZ', price: 2300 }
    const date = new Date('2026-10-07T10:00:00Z')

    expect(diffDirectDeals({ docDate: date, lineItems: [line] }, { docDate: new Date(date), lineItems: [line, { ...line, direction: 'sell' }] }))
      .toEqual([{ line: 2, field: 'line', from: '', to: 'SELL 1 OZ XAU @ 2300 A' }])
    expect(diffDirectDeals({ lineItems: [line, line] }, { lineItems: [line] }))
      .toEqual([{ line: 2, field: 'line', from: 'BUY 1 OZ XAU @ 2300 A', to: '' }])
  })
})

describe('confirmed direct deal lock', () => {
  test('a confirmed deal cannot be edited, even by a super admin, until reopened', async () => {
    const admin = await createUser({ role: 'super_admin' })
    const customer = await createCustomer(admin)
    const deal = await createConfirmedDeal(admin, customer)

    expect(deal.history.map((entry) => entry.action)).toEqual(['created', 'confirmed'])

    const flipped = [{ ...deal.lineItems[0], customerId: customer._id, direction: 'sell' }]
    const res = await request(app)
      .put(`/api/erp-accounting/direct-deals/${deal._id}`)
      .set(authHeader(admin))
      .send({ lineItems: flipped })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('DIRECT_DEAL_CONFIRMED_LOCKED')

    const reopenAndEdit = await request(app)
      .put(`/api/erp-accounting/direct-deals/${deal._id}`)
      .set(authHeader(admin))
      .send({ status: 'draft', reason: 'Wrong direction', lineItems: flipped })
    expect(reopenAndEdit.status).toBe(409)

    const stored = await DirectDeal.findById(deal._id).lean()
    expect(stored.status).toBe('confirmed')
    expect(stored.lineItems[0].direction).toBe('buy')
  })

  test('reopening needs a super admin and a reason', async () => {
    const admin = await createUser({ role: 'super_admin' })
    const financeUser = await createUser()
    const customer = await createCustomer(admin)
    const deal = await createConfirmedDeal(admin, customer)

    const byFinance = await request(app)
      .put(`/api/erp-accounting/direct-deals/${deal._id}`)
      .set(authHeader(financeUser))
      .send({ status: 'draft', reason: 'Customer called back' })
    expect(byFinance.status).toBe(403)

    const noReason = await request(app)
      .put(`/api/erp-accounting/direct-deals/${deal._id}`)
      .set(authHeader(admin))
      .send({ status: 'draft' })
    expect(noReason.status).toBe(400)
    expect(noReason.body.code).toBe('DIRECT_DEAL_REOPEN_REASON_REQUIRED')

    const shortReason = await request(app)
      .put(`/api/erp-accounting/direct-deals/${deal._id}`)
      .set(authHeader(admin))
      .send({ status: 'draft', reason: 'oops' })
    expect(shortReason.status).toBe(400)

    expect((await DirectDeal.findById(deal._id).lean()).status).toBe('confirmed')
  })

  test('reopen, flip Buy to Sell and confirm again is recorded in the history and re-posts the ledger', async () => {
    const admin = await createUser({ role: 'super_admin' })
    const customer = await createCustomer(admin)
    const deal = await createConfirmedDeal(admin, customer)

    const postedBefore = await activeLedgerRows(deal._id)
    expect(postedBefore.length).toBeGreaterThan(0)

    const reopen = await request(app)
      .put(`/api/erp-accounting/direct-deals/${deal._id}`)
      .set(authHeader(admin))
      .send({ status: 'draft', reason: 'Customer was selling, not buying' })
    expect(reopen.status).toBe(200)
    expect(reopen.body.deal.status).toBe('draft')
    expect(await activeLedgerRows(deal._id)).toHaveLength(0)

    const flipped = [{ ...deal.lineItems[0], customerId: customer._id, direction: 'sell' }]
    const confirm = await request(app)
      .put(`/api/erp-accounting/direct-deals/${deal._id}`)
      .set(authHeader(admin))
      .send({ status: 'confirmed', lineItems: flipped })
    expect(confirm.status).toBe(200)

    const history = confirm.body.deal.history
    expect(history.map((entry) => entry.action)).toEqual(['created', 'confirmed', 'reopened', 'edited', 'confirmed'])
    expect(history[2].reason).toBe('Customer was selling, not buying')
    expect(history[2].byName).toBe(admin.name)
    expect(history[3].changes).toEqual([{ line: 1, field: 'direction', from: 'buy', to: 'sell' }])

    const postedAfter = await activeLedgerRows(deal._id)
    expect(postedAfter).toHaveLength(1)
    expect(String(postedAfter[0].creditAccountId)).toBe(String(postedBefore[0].debitAccountId))
    expect(postedAfter[0].amount).toBe(postedBefore[0].amount)
  })

  test('the account statement reflects a reopen immediately instead of serving the cached copy', async () => {
    const admin = await createUser({ role: 'super_admin' })
    const customer = await createCustomer(admin)
    const deal = await createConfirmedDeal(admin, customer)
    const accountCode = (await ChartOfAccount.findById(customer.ledgerAccountId?._id || customer.ledgerAccountId).lean()).accountCode

    const enquiry = () => request(app)
      .get('/api/erp-accounting/accounts/enquiry')
      .query({ accountCode })
      .set(authHeader(admin))

    const before = await enquiry()
    expect(before.status).toBe(200)
    expect(before.body.balances.debitTotal).toBe(4600)
    expect((await enquiry()).headers['x-enquiry-cache']).toBe('HIT')

    const reopen = await request(app)
      .put(`/api/erp-accounting/direct-deals/${deal._id}`)
      .set(authHeader(admin))
      .send({ status: 'draft', reason: 'Wrong customer selected' })
    expect(reopen.status).toBe(200)
    await new Promise((resolve) => setImmediate(resolve))

    const after = await enquiry()
    expect(after.body.balances.debitTotal).toBe(0)
  })

  test('draft edits before the first confirmation are not logged as edits', async () => {
    const financeUser = await createUser()
    const customer = await createCustomer(financeUser)
    const created = await request(app)
      .post('/api/erp-accounting/direct-deals')
      .set(authHeader(financeUser))
      .send({
        currency: 'USD',
        status: 'draft',
        lineItems: [{ customerId: customer._id, customerName: customer.name, direction: 'buy', metal: 'XAU', qty: 1, price: 2300, stockCode: 'OZ' }],
      })
    expect(created.status).toBe(201)

    const res = await request(app)
      .put(`/api/erp-accounting/direct-deals/${created.body.deal._id}`)
      .set(authHeader(financeUser))
      .send({ remarks: 'typo fix', status: 'confirmed' })
    expect(res.status).toBe(200)
    expect(res.body.deal.history.map((entry) => entry.action)).toEqual(['created', 'confirmed'])
  })

  test('deleting a confirmed deal needs a reason and is recorded', async () => {
    const admin = await createUser({ role: 'super_admin' })
    const customer = await createCustomer(admin)
    const deal = await createConfirmedDeal(admin, customer)

    const noReason = await request(app)
      .delete(`/api/erp-accounting/direct-deals/${deal._id}`)
      .set(authHeader(admin))
    expect(noReason.status).toBe(400)
    expect(noReason.body.code).toBe('DIRECT_DEAL_DELETE_REASON_REQUIRED')

    const res = await request(app)
      .delete(`/api/erp-accounting/direct-deals/${deal._id}`)
      .set(authHeader(admin))
      .send({ reason: 'Duplicate of another deal' })
    expect(res.status).toBe(200)

    const stored = await DirectDeal.findById(deal._id).lean()
    expect(stored.isDeleted).toBe(true)
    expect(stored.history.at(-1)).toMatchObject({ action: 'deleted', reason: 'Duplicate of another deal' })
    expect(await activeLedgerRows(deal._id)).toHaveLength(0)
  })
})
