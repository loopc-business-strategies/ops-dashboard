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
const InventoryItem = require('../models/InventoryItem')
const Ledger = require('../models/Ledger')
const User = require('../models/User')
const Vendor = require('../models/Vendor')

let mongo
let app

const TEST_TENANT = 'loopc'
const tokenFor = (user) => jwt.sign({ id: user._id.toString(), company: TEST_TENANT }, process.env.JWT_SECRET)
const authHeader = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` })

const createUser = async (overrides = {}) => {
  const now = Date.now().toString(36)
  return User.create({
    name: `contract-${now}-${Math.random().toString(36).slice(2, 8)}`,
    email: `contract-${now}-${Math.random().toString(36).slice(2, 8)}@example.com`,
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
  await Ledger.deleteMany({})
  await DirectDeal.deleteMany({})
  await InventoryItem.deleteMany({})
  await Vendor.deleteMany({})
  await Customer.deleteMany({})
  await ChartOfAccount.deleteMany({})
  await User.deleteMany({})
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('ERP accounting API contracts', () => {
  test('health endpoint contract remains stable', async () => {
    const res = await request(app).get('/api/health')

    expect(res.status).toBe(200)

    const normalized = {
      success: res.body.success,
      message: res.body.message,
      hasTime: Boolean(res.body.time),
      build: {
        version: String(res.body?.build?.version || ''),
        hasSha: typeof res.body?.build?.sha === 'string',
        hasBuiltAt: typeof res.body?.build?.builtAt === 'string',
      },
      backendMirror: {
        version: String(res.body?.backend?.version || ''),
        hasSha: typeof res.body?.backend?.sha === 'string',
        hasBuiltAt: typeof res.body?.backend?.builtAt === 'string',
      },
    }

    expect(normalized).toMatchInlineSnapshot(`
{
  "backendMirror": {
    "hasBuiltAt": true,
    "hasSha": true,
    "version": "1.0.0",
  },
  "build": {
    "hasBuiltAt": true,
    "hasSha": true,
    "version": "1.0.0",
  },
  "hasTime": true,
  "message": "Server is running!",
  "success": true,
}
`)
  })

  test('accounts endpoint unauthorized contract remains stable', async () => {
    const res = await request(app).get('/api/erp-accounting/accounts')

    const normalized = {
      status: res.status,
      success: res.body?.success,
      message: String(res.body?.message || ''),
    }

    expect(normalized).toMatchInlineSnapshot(`
{
  "message": "Please log in to access this.",
  "status": 401,
  "success": false,
}
`)
  })

  test('accounts endpoint authorized empty-list contract remains stable', async () => {
    const financeUser = await createUser()

    const res = await request(app)
      .get('/api/erp-accounting/accounts?page=1&limit=5')
      .set(authHeader(financeUser))

    expect(res.status).toBe(200)

    const normalized = {
      success: res.body.success,
      total: Number(res.body.total || 0),
      page: Number(res.body.page || 0),
      limit: Number(res.body.limit || 0),
      accountsType: Array.isArray(res.body.accounts) ? 'array' : typeof res.body.accounts,
      accountsLength: Array.isArray(res.body.accounts) ? res.body.accounts.length : -1,
    }

    expect(normalized).toMatchInlineSnapshot(`
{
  "accountsLength": 0,
  "accountsType": "array",
  "limit": 5,
  "page": 1,
  "success": true,
  "total": 0,
}
`)
  })

  test('ledger endpoint filters by journal reference type', async () => {
    const financeUser = await createUser()
    const cash = await ChartOfAccount.create({
      accountName: 'Cash',
      accountCode: '1100',
      accountType: 'Asset',
      createdBy: financeUser._id,
    })
    const revenue = await ChartOfAccount.create({
      accountName: 'Sales',
      accountCode: '4100',
      accountType: 'Income',
      createdBy: financeUser._id,
    })
    await Ledger.create({
      debitAccountId: cash._id,
      creditAccountId: revenue._id,
      amount: 100,
      referenceType: 'sale',
      createdBy: financeUser._id,
    })
    await Ledger.create({
      debitAccountId: cash._id,
      creditAccountId: revenue._id,
      amount: 50,
      referenceType: 'journal',
      createdBy: financeUser._id,
    })

    const res = await request(app)
      .get('/api/erp-accounting/ledger?referenceType=journal&limit=500')
      .set(authHeader(financeUser))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.count).toBe(1)
    expect(res.body.entries[0].referenceType).toBe('journal')
  })

  test('customer creation contract remains stable', async () => {
    const financeUser = await createUser()

    const res = await request(app)
      .post('/api/erp-accounting/customers')
      .set(authHeader(financeUser))
      .send({
        name: 'Contract Customer',
        currency: 'USD',
        openingBalance: 0,
      })

    expect(res.status).toBe(201)

    const normalized = {
      success: res.body.success,
      name: String(res.body?.customer?.name || ''),
      currency: String(res.body?.customer?.currency || ''),
      hasLedgerAccountId: Boolean(res.body?.customer?.ledgerAccountId),
    }

    expect(normalized).toMatchInlineSnapshot(`
{
  "currency": "USD",
  "hasLedgerAccountId": true,
  "name": "Contract Customer",
  "success": true,
}
`)
  })

  test('vendor creation contract remains stable', async () => {
    const financeUser = await createUser()

    const res = await request(app)
      .post('/api/erp-accounting/vendors')
      .set(authHeader(financeUser))
      .send({
        name: 'Contract Vendor',
        currency: 'USD',
        category: 'general',
      })

    expect(res.status).toBe(201)

    const normalized = {
      success: res.body.success,
      name: String(res.body?.vendor?.name || ''),
      vendorCodePrefix: String(res.body?.vendor?.vendorCode || '').slice(0, 3),
      hasLedgerAccountId: Boolean(res.body?.vendor?.ledgerAccountId),
      approvalStatus: String(res.body?.vendor?.approvalStatus || ''),
    }

    expect(normalized).toMatchInlineSnapshot(`
{
  "approvalStatus": "draft",
  "hasLedgerAccountId": true,
  "name": "Contract Vendor",
  "success": true,
  "vendorCodePrefix": "VEN",
}
`)
  })

  test('inventory product creation contract remains stable', async () => {
    const financeUser = await createUser()

    const res = await request(app)
      .post('/api/erp-accounting/inventory/products')
      .set(authHeader(financeUser))
      .send({
        name: 'Contract Inventory Item',
        category: 'raw-material',
        unit: 'pcs',
        currency: 'USD',
      })

    expect(res.status).toBe(201)

    const normalized = {
      success: res.body.success,
      name: String(res.body?.product?.name || ''),
      category: String(res.body?.product?.category || ''),
      hasLedgerAccountId: Boolean(res.body?.product?.ledgerAccountId),
    }

    expect(normalized).toMatchInlineSnapshot(`
{
  "category": "raw-material",
  "hasLedgerAccountId": true,
  "name": "Contract Inventory Item",
  "success": true,
}
`)
  })

  test('direct deal creation auto-generates doc numbers', async () => {
    const financeUser = await createUser()

    const customerRes = await request(app)
      .post('/api/erp-accounting/customers')
      .set(authHeader(financeUser))
      .send({
        name: 'Direct Deal Customer',
        currency: 'USD',
      })

    expect(customerRes.status).toBe(201)

    const res = await request(app)
      .post('/api/erp-accounting/direct-deals')
      .set(authHeader(financeUser))
      .send({
        entryType: 'fixing',
        currency: 'USD',
        status: 'draft',
        lineItems: [{
          customerId: customerRes.body.customer._id,
          customerName: 'Direct Deal Customer',
          direction: 'buy',
          metal: 'XAU',
          qty: 1,
          price: 2300,
          stockCode: 'GOLD',
        }],
      })

    expect(res.status).toBe(201)

    const normalized = {
      success: res.body.success,
      docNoPattern: /^ORD\/\d{4}\/\d{6}$/.test(String(res.body?.deal?.docNo || '')),
      status: String(res.body?.deal?.status || ''),
      totalQty: Number(res.body?.deal?.totalQty || 0),
      totalAmount: Number(res.body?.deal?.totalAmount || 0),
    }

    expect(normalized).toMatchInlineSnapshot(`
{
  "docNoPattern": true,
  "status": "draft",
  "success": true,
  "totalAmount": 2300,
  "totalQty": 1,
}
`)
  })
})
