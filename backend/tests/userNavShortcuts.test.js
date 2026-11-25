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
const UserNavShortcuts = require('../models/UserNavShortcuts')
const { MAX_RECENT } = require('../services/userNavShortcutsService')

let mongo
let app

const TEST_TENANT = 'loopc'
const tokenFor = (user) => jwt.sign({ id: user._id.toString(), company: TEST_TENANT }, process.env.JWT_SECRET)

const createUser = async (overrides = {}) => {
  const now = Date.now().toString(36)
  return User.create({
    name: `user-${now}-${Math.random().toString(36).slice(2, 8)}`,
    email: `user-${now}-${Math.random().toString(36).slice(2, 8)}@example.com`,
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
  await Promise.all([
    User.deleteMany({}),
    UserNavShortcuts.deleteMany({}),
  ])
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('user nav shortcuts (favorites + recent)', () => {
  test('add/get/remove favorite; rejects unknown nav item', async () => {
    const user = await createUser()
    const token = tokenFor(user)

    const bad = await request(app)
      .post('/api/auth/me/favorites')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant', TEST_TENANT)
      .send({ navItemId: 'not-a-real-page' })
    expect(bad.status).toBe(400)

    const added = await request(app)
      .post('/api/auth/me/favorites')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant', TEST_TENANT)
      .send({ navItemId: 'erp-ledger' })
    expect(added.status).toBe(201)
    expect(added.body.favorites.map((f) => f.navItemId)).toEqual(['erp-ledger'])

    const dup = await request(app)
      .post('/api/auth/me/favorites')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant', TEST_TENANT)
      .send({ navItemId: 'erp-ledger' })
    expect(dup.status).toBe(201)
    expect(dup.body.favorites).toHaveLength(1)

    const listed = await request(app)
      .get('/api/auth/me/favorites')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant', TEST_TENANT)
    expect(listed.status).toBe(200)
    expect(listed.body.favorites).toHaveLength(1)

    const removed = await request(app)
      .delete('/api/auth/me/favorites/erp-ledger')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant', TEST_TENANT)
    expect(removed.status).toBe(200)
    expect(removed.body.favorites).toEqual([])
  })

  test('reorder favorites and keep per-user isolation', async () => {
    const a = await createUser()
    const b = await createUser()
    const tokenA = tokenFor(a)
    const tokenB = tokenFor(b)

    await request(app).post('/api/auth/me/favorites').set('Authorization', `Bearer ${tokenA}`).set('x-tenant', TEST_TENANT).send({ navItemId: 'hr' })
    await request(app).post('/api/auth/me/favorites').set('Authorization', `Bearer ${tokenA}`).set('x-tenant', TEST_TENANT).send({ navItemId: 'erp-vouchers' })
    await request(app).post('/api/auth/me/favorites').set('Authorization', `Bearer ${tokenB}`).set('x-tenant', TEST_TENANT).send({ navItemId: 'finance' })

    const reordered = await request(app)
      .put('/api/auth/me/favorites/order')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant', TEST_TENANT)
      .send({ navItemIds: ['erp-vouchers', 'hr'] })
    expect(reordered.status).toBe(200)
    expect(reordered.body.favorites.map((f) => f.navItemId)).toEqual(['erp-vouchers', 'hr'])

    const listB = await request(app)
      .get('/api/auth/me/favorites')
      .set('Authorization', `Bearer ${tokenB}`)
      .set('x-tenant', TEST_TENANT)
    expect(listB.body.favorites.map((f) => f.navItemId)).toEqual(['finance'])
  })

  test('recent tracks unique pages, bumps order, trims to max, and clears', async () => {
    const user = await createUser()
    const token = tokenFor(user)

    const pages = [
      'overview', 'hr', 'finance', 'sales', 'operations',
      'erp-ledger', 'erp-vouchers', 'erp-inventory', 'erp-reports', 'erp-enquiry',
      'erp-customers',
    ]
    for (const navItemId of pages) {
      const res = await request(app)
        .post('/api/auth/me/recent')
        .set('Authorization', `Bearer ${token}`)
        .set('x-tenant', TEST_TENANT)
        .send({ navItemId })
      expect(res.status).toBe(200)
    }

    let recent = await request(app)
      .get('/api/auth/me/recent')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant', TEST_TENANT)
    expect(recent.body.recent).toHaveLength(MAX_RECENT)
    expect(recent.body.recent[0].navItemId).toBe('erp-customers')
    expect(recent.body.recent.map((r) => r.navItemId)).not.toContain('overview')

    await request(app)
      .post('/api/auth/me/recent')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant', TEST_TENANT)
      .send({ navItemId: 'hr' })

    recent = await request(app)
      .get('/api/auth/me/recent')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant', TEST_TENANT)
    expect(recent.body.recent[0].navItemId).toBe('hr')
    expect(recent.body.recent.filter((r) => r.navItemId === 'hr')).toHaveLength(1)

    const cleared = await request(app)
      .delete('/api/auth/me/recent')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant', TEST_TENANT)
    expect(cleared.status).toBe(200)
    expect(cleared.body.recent).toEqual([])
  })

  test('requires auth', async () => {
    const res = await request(app).get('/api/auth/me/favorites').set('x-tenant', TEST_TENANT)
    expect(res.status).toBe(401)
  })
})
