const request = require('supertest')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const { MongoMemoryServer } = require('mongodb-memory-server')

const createApp = require('../app')
const User = require('../models/User')

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

  mongo = await MongoMemoryServer.create()
  const mongoUri = mongo.getUri()
  process.env.MONGO_URI = mongoUri
  process.env.MONGO_URI_LOOPC = mongoUri
  process.env.MONGO_URI_MG = mongoUri
  process.env.MONGO_URI_CG = mongoUri

  await mongoose.connect(mongoUri)
  app = createApp()
})

afterEach(async () => {
  await User.deleteMany({})
})

afterAll(async () => {
  await mongoose.disconnect()
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
})
