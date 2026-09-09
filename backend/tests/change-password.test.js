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
    email: `${tenant}-changepw-${now}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: 'password123',
    role: 'department_user',
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

describe('PUT /api/auth/change-password', () => {
  test('rejects incorrect current password', async () => {
    const user = await createTenantUser('loopc')
    const token = tokenFor(user, 'loopc')

    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'loopc')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrong-password', newPassword: 'Newpass123!' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(String(res.body.message || '')).toMatch(/current password/i)
  })

  test('rejects when new password equals current password', async () => {
    const user = await createTenantUser('loopc')
    const token = tokenFor(user, 'loopc')

    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'loopc')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'password123', newPassword: 'password123' })

    expect(res.status).toBe(400)
    expect(String(res.body.message || '')).toMatch(/different/i)
  })

  test('changes password, re-issues session, and invalidates old token', async () => {
    const user = await createTenantUser('loopc')
    const oldToken = tokenFor(user, 'loopc')
    await new Promise((resolve) => { setTimeout(resolve, 1100) })

    const changeRes = await request(app)
      .put('/api/auth/change-password')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'loopc')
      .set('X-Client', 'mobile')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ currentPassword: 'password123', newPassword: 'Newpass123!' })

    expect(changeRes.status).toBe(200)
    expect(changeRes.body.success).toBe(true)
    expect(changeRes.body.token).toBeTruthy()
    expect(changeRes.body.user?.id).toBe(user._id.toString())

    const oldMe = await request(app)
      .get('/api/auth/me')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'loopc')
      .set('Authorization', `Bearer ${oldToken}`)

    expect(oldMe.status).toBe(401)

    const newMe = await request(app)
      .get('/api/auth/me')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'loopc')
      .set('Authorization', `Bearer ${changeRes.body.token}`)

    expect(newMe.status).toBe(200)
    expect(newMe.body.success).toBe(true)
  })
})
