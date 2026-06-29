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
const { MAX_SESSION_AGE_MS, resolveSessionMaxAgeMs } = require('../services/adminSettings')

let mongo
let app

const tokenFor = (user, tenant) => jwt.sign(
  { id: user._id.toString(), company: tenant },
  process.env.JWT_SECRET,
  { algorithm: 'HS256' },
)

const createTenantUser = async (tenant, overrides = {}) => {
  const TenantUser = await User.getTenantModel(tenant)
  const now = Date.now().toString(36)
  return TenantUser.create({
    name: `${tenant}-user-${now}-${Math.random().toString(36).slice(2, 8)}`,
    email: `${tenant}-revoke-${now}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: 'password123',
    role: 'super_admin',
    department: '',
    ...overrides,
  })
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.RATE_LIMIT_MAX = '100000'
  process.env.AUTH_RATE_LIMIT_MAX = '100000'
  process.env.DEFAULT_TENANT = 'loopc'

  mongo = await startMongoMemoryServer()
  const mongoUri = mongo.getUri()
  process.env.MONGO_URI = mongoUri
  process.env.MONGO_URI_LOOPC = mongoUri

  await mongoose.connect(mongoUri)
  app = createApp()
})

afterEach(async () => {
  if (!isMongooseConnected(mongoose)) return
  await (await User.getTenantModel('loopc')).deleteMany({})
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('session revocation', () => {
  test('persistent session max age is capped at 30 days', () => {
    expect(resolveSessionMaxAgeMs({ sessionTimeoutMinutes: '0' })).toBeLessThanOrEqual(MAX_SESSION_AGE_MS)
    expect(MAX_SESSION_AGE_MS).toBe(30 * 24 * 60 * 60 * 1000)
  })

  test('rejects tokens issued before sessionInvalidatedAt', async () => {
    const user = await createTenantUser('loopc')
    const token = tokenFor(user, 'loopc')
    await new Promise((resolve) => { setTimeout(resolve, 1100) })

    const TenantUser = await User.getTenantModel('loopc')
    await TenantUser.updateOne({ _id: user._id }, { $set: { sessionInvalidatedAt: new Date() } })

    const res = await request(app)
      .get('/api/auth/me')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'loopc')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(401)
    expect(String(res.body.message || '')).toMatch(/revoked/i)
  })

  test('logout-all-devices invalidates existing tokens', async () => {
    const user = await createTenantUser('loopc')
    const token = tokenFor(user, 'loopc')
    await new Promise((resolve) => { setTimeout(resolve, 1100) })

    const logoutRes = await request(app)
      .post('/api/auth/logout-all-devices')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'loopc')
      .set('Authorization', `Bearer ${token}`)

    expect(logoutRes.status).toBe(200)
    expect(logoutRes.body.success).toBe(true)

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'loopc')
      .set('Authorization', `Bearer ${token}`)

    expect(meRes.status).toBe(401)
  })

  test('password change invalidates prior sessions', async () => {
    const user = await createTenantUser('loopc')
    const token = tokenFor(user, 'loopc')
    await new Promise((resolve) => { setTimeout(resolve, 1100) })

    const TenantUser = await User.getTenantModel('loopc')
    const stored = await TenantUser.findById(user._id).select('+password')
    stored.password = 'newpassword456'
    await stored.save()

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'loopc')
      .set('Authorization', `Bearer ${token}`)

    expect(meRes.status).toBe(401)
  })
})
