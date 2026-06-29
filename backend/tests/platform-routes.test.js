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

const LOOPC = 'loopc'
const tokenFor = (user, company = LOOPC) => jwt.sign({ id: user._id.toString(), company }, process.env.JWT_SECRET)

const createUser = async (overrides = {}) => {
  const now = Date.now().toString(36)
  return User.create({
    name: `user-${now}`,
    email: `user-${now}@example.com`,
    password: 'password123',
    role: 'department_user',
    department: 'operations',
    ...overrides,
  })
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.RATE_LIMIT_MAX = '100000'
  process.env.AUTH_RATE_LIMIT_MAX = '100000'
  process.env.DEFAULT_TENANT = LOOPC

  mongo = await startMongoMemoryServer()
  const mongoUri = mongo.getUri()
  process.env.MONGO_URI = mongoUri
  process.env.MONGO_URI_LOOPC = mongoUri
  process.env.MONGO_URI_MG = mongoUri
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

describe('Platform and admin tenant routes', () => {
  test('GET /api/platform/tenants/public requires no auth', async () => {
    const res = await request(app).get('/api/platform/tenants/public')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.tenants)).toBe(true)
    expect(res.body.tenants.length).toBeGreaterThan(0)
  })

  test('GET /api/admin/tenants/catalog requires authentication', async () => {
    const res = await request(app).get('/api/admin/tenants/catalog')
    expect(res.status).toBe(401)
  })

  test('non-loopc super admin cannot read tenant catalog', async () => {
    const admin = await createUser({ role: 'super_admin', department: '' })
    const res = await request(app)
      .get('/api/admin/tenants/catalog')
      .set('Authorization', `Bearer ${tokenFor(admin, 'mg')}`)
      .set('x-tenant', 'mg')

    expect(res.status).toBe(403)
  })

  test('loopc super admin can read tenant catalog', async () => {
    const admin = await createUser({ role: 'super_admin', department: '' })
    const res = await request(app)
      .get('/api/admin/tenants/catalog')
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .set('x-tenant', LOOPC)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.tenants)).toBe(true)
    expect(Array.isArray(res.body.onboardingChecklist)).toBe(true)
  })
})
