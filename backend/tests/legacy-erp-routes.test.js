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

let mongo
let app

const TEST_TENANT = 'loopc'
const tokenFor = (user) => jwt.sign({ id: user._id.toString(), company: TEST_TENANT }, process.env.JWT_SECRET)

const createUser = async (overrides = {}) => {
  const now = Date.now().toString(36)
  const base = {
    name: `user-${now}-${Math.random().toString(36).slice(2, 8)}`,
    email: `user-${now}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: 'password123',
    role: 'department_user',
    department: 'operations',
  }
  return User.create({ ...base, ...overrides })
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
  await mongoose.connect(mongoUri)
  app = createApp()
})

afterEach(async () => {
  if (!isMongooseConnected(mongoose)) return
  await User.deleteMany({})
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('Legacy ERP routes', () => {
  test('POST /api/erp/procurement/suppliers returns 410 with deprecation headers', async () => {
    const user = await createUser({ role: 'super_admin', department: '' })

    const res = await request(app)
      .post('/api/erp/procurement/suppliers')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ name: 'Legacy Supplier' })

    expect(res.status).toBe(410)
    expect(res.headers.deprecation).toBe('true')
    expect(res.body.deprecation.useInstead).toBe('/api/erp-accounting/vendors')
  })

  test('GET /api/erp/finance/records returns 410 with legacy header', async () => {
    const user = await createUser({ role: 'super_admin', department: '' })

    const res = await request(app)
      .get('/api/erp/finance/records')
      .set('Authorization', `Bearer ${tokenFor(user)}`)

    expect(res.status).toBe(410)
    expect(res.headers['x-legacy-erp-api']).toBe('true')
    expect(res.body.deprecation.useInstead).toBe('/api/erp-accounting')
  })

  test('POST /api/erp/finance/records returns 410', async () => {
    const user = await createUser({ role: 'super_admin', department: '' })

    const res = await request(app)
      .post('/api/erp/finance/records')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ amount: 100 })

    expect(res.status).toBe(410)
    expect(res.headers['x-legacy-erp-api']).toBe('true')
  })

  test('authenticated GET /api/erp/inventory smoke returns legacy header', async () => {
    const user = await createUser({ role: 'department_user', department: 'operations' })

    const res = await request(app)
      .get('/api/erp/inventory')
      .set('Authorization', `Bearer ${tokenFor(user)}`)

    expect(res.status).toBe(200)
    expect(res.headers['x-legacy-erp-api']).toBe('true')
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.items)).toBe(true)
  })
})
