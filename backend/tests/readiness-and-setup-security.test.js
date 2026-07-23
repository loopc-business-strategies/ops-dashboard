const request = require('supertest')
const mongoose = require('mongoose')
const {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')
const { setPrimaryMongoReady } = require('../services/readiness')

const createApp = require('../app')
const User = require('../models/User')

jest.setTimeout(120000)

let mongo
let app

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.DEFAULT_TENANT = 'loopc'
  process.env.MONGO_URI_LOOPC = ''
  process.env.MONGO_URI_MG = ''
  process.env.MONGO_URI_CG = ''

  mongo = await startMongoMemoryServer()
  const mongoUri = mongo.getUri()
  process.env.MONGO_URI = mongoUri
  process.env.MONGO_URI_LOOPC = mongoUri
  process.env.MONGO_URI_MG = mongoUri
  process.env.MONGO_URI_CG = mongoUri

  await mongoose.connect(mongoUri, { maxPoolSize: 1 })
  const registry = require('../db/tenantModelRegistry')
  registry.registerAllOnConnection(mongoose.connection)

  setPrimaryMongoReady(true)
  app = createApp()
})

afterEach(async () => {
  if (isMongooseConnected(mongoose)) {
    await User.deleteMany({})
  }
})

afterAll(async () => {
  setPrimaryMongoReady(false)
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('readiness and setup security', () => {
  test('/api/health stays simple liveness', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.ready).toBeUndefined()
  })

  test('/api/ready reports ready when JWT and tenant DB are available', async () => {
    const res = await request(app).get('/api/ready')
    expect(res.status).toBe(200)
    expect(res.body.ready).toBe(true)
    expect(res.body.checks.jwtSecret).toBe(true)
    expect(res.body.checks.mongoConnected).toBe(true)
    expect(res.body.checks.tenants.loopc.ready).toBe(true)
    expect(res.body.checks.redisConfigured).toBe(false)
    expect(res.body.checks.redisReady).toBe(null)
    expect(res.body.checks.redisRequired).toBe(false)
    expect(res.body.checks.expectedReplicas).toBe(1)
    expect(res.body.checks.redisRecommended).toBe(false)
    expect(res.body.checks.socketIoRedisAdapter).toBe(false)
    expect(res.body.checks.sentryConfigured).toBe(false)
    expect(res.body.warnings).toEqual([])
    expect(res.body.build).toBeDefined()
    expect(res.body.build.commit).toBeDefined()
    expect(res.body.checks.integrations.expoPushAccessTokenSet).toBe(false)
    expect(res.body.checks.integrations.webPushVapidKeysSet).toBe(false)
  })

  test('/api/ready returns 503 when JWT secret is missing', async () => {
    const previous = process.env.JWT_SECRET
    delete process.env.JWT_SECRET

    const res = await request(app).get('/api/ready')
    expect(res.status).toBe(503)
    expect(res.body.ready).toBe(false)
    expect(res.body.checks.jwtSecret).toBe(false)

    process.env.JWT_SECRET = previous
  })

  test('setup is blocked in production without ENABLE_SETUP and SETUP_TOKEN', async () => {
    const previousNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const res = await request(app)
      .post('/api/auth/setup')
      .set('x-tenant', 'loopc')
      .send({ name: 'Bootstrap Admin', password: 'Password123!' })

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/disabled in production/i)

    process.env.NODE_ENV = previousNodeEnv
  })

  test('setup requires matching SETUP_TOKEN when enabled in production', async () => {
    const previousNodeEnv = process.env.NODE_ENV
    const previousEnable = process.env.ENABLE_SETUP
    const previousToken = process.env.SETUP_TOKEN

    process.env.NODE_ENV = 'production'
    process.env.ENABLE_SETUP = 'true'
    process.env.SETUP_TOKEN = 'one-time-setup-token'

    const missingTokenRes = await request(app)
      .post('/api/auth/setup')
      .set('x-tenant', 'loopc')
      .send({ name: 'Bootstrap Admin', password: 'Password123!' })

    expect(missingTokenRes.status).toBe(403)

    const okRes = await request(app)
      .post('/api/auth/setup')
      .set('x-tenant', 'loopc')
      .set('x-setup-token', 'one-time-setup-token')
      .send({ name: 'Bootstrap Admin', password: 'Password123!', setupToken: 'one-time-setup-token' })

    expect(okRes.status).toBe(201)
    expect(okRes.body.user.role).toBe('super_admin')

    process.env.NODE_ENV = previousNodeEnv
    process.env.ENABLE_SETUP = previousEnable
    process.env.SETUP_TOKEN = previousToken
  })
})
