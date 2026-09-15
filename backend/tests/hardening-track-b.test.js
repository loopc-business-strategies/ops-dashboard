/**
 * Lightweight contract tests for Track B hardening routes (mount + auth gate).
 */
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

const tokenFor = (user, tenant = 'loopc') => jwt.sign(
  { id: user._id.toString(), company: tenant },
  process.env.JWT_SECRET,
  { algorithm: 'HS256' },
)

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

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

beforeEach(async () => {
  const TenantUser = await User.getTenantModel('loopc')
  await TenantUser.deleteMany({})
})

function auth(user) {
  return {
    Host: 'api.loopcstrategies.com',
    'x-tenant': 'loopc',
    Authorization: `Bearer ${tokenFor(user)}`,
  }
}

test('approval policy and search require auth', async () => {
  expect((await request(app).get('/api/approvals/approval-policy')).status).toBe(401)
  expect((await request(app).get('/api/search').query({ q: 'gold' })).status).toBe(401)
  expect((await request(app).get('/api/exceptions')).status).toBe(401)
  expect((await request(app).get('/api/hardware/contract')).status).toBe(401)
})

test('authenticated user can read approval policy, search, hardware contract', async () => {
  const TenantUser = await User.getTenantModel('loopc')
  const user = await TenantUser.create({
    name: 'Hardening Admin',
    email: `harden-${Date.now()}@example.com`,
    password: 'password123',
    role: 'super_admin',
    department: 'management',
  })
  const headers = auth(user)

  const policy = await request(app).get('/api/approvals/approval-policy').set(headers)
  expect(policy.status).toBe(200)
  expect(policy.body.verbs).toEqual(expect.arrayContaining(['submit', 'approve', 'post']))

  const search = await request(app).get('/api/search').query({ q: 'test' }).set(headers)
  expect(search.status).toBe(200)
  expect(Array.isArray(search.body.results)).toBe(true)

  const hw = await request(app).get('/api/hardware/contract').set(headers)
  expect(hw.status).toBe(200)
  expect(hw.body.ingestPath).toContain('/api/hardware/ingest')

  const scan = await request(app).post('/api/scan/resolve').set(headers).send({ code: 'NO-SUCH-CODE' })
  expect(scan.status).toBe(404)

  const sod = await request(app).post('/api/approvals/approval-policy/check').set(headers).send({
    entityType: 'payment',
    creatorId: String(user._id),
    approverId: String(user._id),
    amount: 99999,
  })
  expect(sod.status).toBe(403)
  expect(sod.body.code).toBe('SOD_VIOLATION')
})
