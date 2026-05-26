const request = require('supertest')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')

const createApp = require('../app')
const User = require('../models/User')
const Customer = require('../models/Customer')
const Vendor = require('../models/Vendor')
const Transaction = require('../models/Transaction')

let mongo
let app

const TEST_TENANT = 'loopc'
const tokenFor = (user) => jwt.sign({ id: user._id.toString(), company: TEST_TENANT }, process.env.JWT_SECRET)
const authHeader = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` })

const createFinanceUser = async (overrides = {}) => {
  const now = Date.now().toString(36)
  return User.create({
    name: `schema-${now}-${Math.random().toString(36).slice(2, 8)}`,
    email: `schema-${now}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: 'password123',
    role: 'department_head',
    department: 'finance',
    ...overrides,
  })
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
  await Promise.all([
    Transaction.deleteMany({}),
    Vendor.deleteMany({}),
    Customer.deleteMany({}),
    User.deleteMany({}),
  ])
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('ERP accounting patch schema strictness', () => {
  test('customer patch rejects unknown field and accepts valid partial field', async () => {
    const financeUser = await createFinanceUser()

    const createRes = await request(app)
      .post('/api/erp-accounting/customers')
      .set(authHeader(financeUser))
      .send({ name: 'Schema Customer', currency: 'USD' })

    expect(createRes.status).toBe(201)

    const badPatch = await request(app)
      .put(`/api/erp-accounting/customers/${createRes.body.customer._id}`)
      .set(authHeader(financeUser))
      .send({ unknownField: 'x' })

    expect(badPatch.status).toBe(400)
    expect(String(badPatch.body.message || '')).toMatch(/not allowed/i)

    const goodPatch = await request(app)
      .put(`/api/erp-accounting/customers/${createRes.body.customer._id}`)
      .set(authHeader(financeUser))
      .send({ phone: '+971500000001' })

    expect(goodPatch.status).toBe(200)
    expect(goodPatch.body.success).toBe(true)
    expect(goodPatch.body.customer.phone).toBe('+971500000001')
  })

  test('vendor patch rejects unknown field and accepts valid partial field', async () => {
    const financeUser = await createFinanceUser()

    const createRes = await request(app)
      .post('/api/erp-accounting/vendors')
      .set(authHeader(financeUser))
      .send({ name: 'Schema Vendor', currency: 'USD' })

    expect(createRes.status).toBe(201)

    const badPatch = await request(app)
      .put(`/api/erp-accounting/vendors/${createRes.body.vendor._id}`)
      .set(authHeader(financeUser))
      .send({ unknownField: 'x' })

    expect(badPatch.status).toBe(400)
    expect(String(badPatch.body.message || '')).toMatch(/not allowed/i)

    const goodPatch = await request(app)
      .put(`/api/erp-accounting/vendors/${createRes.body.vendor._id}`)
      .set(authHeader(financeUser))
      .send({ notes: 'Operational review complete' })

    expect(goodPatch.status).toBe(200)
    expect(goodPatch.body.success).toBe(true)
    expect(goodPatch.body.vendor.notes).toBe('Operational review complete')
  })

  test('transaction patch rejects unknown field and accepts valid partial field', async () => {
    const financeUser = await createFinanceUser()

    const createRes = await request(app)
      .post('/api/erp-accounting/transactions')
      .set(authHeader(financeUser))
      .send({
        type: 'expense',
        amount: 100,
        description: 'Schema transaction',
        currency: 'USD',
      })

    expect(createRes.status).toBe(201)

    const badPatch = await request(app)
      .put(`/api/erp-accounting/transactions/${createRes.body.transaction._id}`)
      .set(authHeader(financeUser))
      .send({ unknownField: 'x' })

    expect(badPatch.status).toBe(400)
    expect(String(badPatch.body.message || '')).toMatch(/not allowed/i)

    const goodPatch = await request(app)
      .put(`/api/erp-accounting/transactions/${createRes.body.transaction._id}`)
      .set(authHeader(financeUser))
      .send({ description: 'Schema transaction updated' })

    expect(goodPatch.status).toBe(200)
    expect(goodPatch.body.success).toBe(true)
    expect(goodPatch.body.transaction.description).toBe('Schema transaction updated')
  })
})
