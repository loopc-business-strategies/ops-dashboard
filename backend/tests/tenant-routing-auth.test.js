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

const tokenFor = (user, tenant) => jwt.sign({ id: user._id.toString(), company: tenant }, process.env.JWT_SECRET)

const createTenantUser = async (tenant, overrides = {}) => {
  const TenantUser = await User.getTenantModel(tenant)
  const now = Date.now().toString(36)
  return TenantUser.create({
    name: `${tenant}-user-${now}-${Math.random().toString(36).slice(2, 8)}`,
    email: `${tenant}-user-${now}-${Math.random().toString(36).slice(2, 8)}@example.com`,
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
  process.env.MONGO_URI_MG = mongoUri
  process.env.MONGO_URI_CG = mongoUri

  await mongoose.connect(mongoUri)
  app = createApp()
})

afterEach(async () => {
  if (!isMongooseConnected(mongoose)) return
  await Promise.all([
    (await User.getTenantModel('loopc')).deleteMany({}),
    (await User.getTenantModel('mg')).deleteMany({}),
    (await User.getTenantModel('cg')).deleteMany({}),
  ])
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('Tenant host/header/session consistency', () => {
  test('rejects session token when host tenant does not match token tenant', async () => {
    const loopcUser = await createTenantUser('loopc')

    const res = await request(app)
      .get('/api/auth/me')
      .set('Host', 'mg.loopcstrategies.com')
      .set('Authorization', `Bearer ${tokenFor(loopcUser, 'loopc')}`)

    expect(res.status).toBe(401)
    expect(String(res.body.message || '')).toMatch(/tenant does not match/i)
  })

  test('allows token tenant when API host is neutral and x-tenant header matches token tenant', async () => {
    const mgUser = await createTenantUser('mg')

    const res = await request(app)
      .get('/api/auth/me')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('x-company', 'mg')
      .set('Authorization', `Bearer ${tokenFor(mgUser, 'mg')}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.user.company).toBe('mg')
  })
})