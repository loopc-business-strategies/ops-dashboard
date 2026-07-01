const request = require('supertest')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')

jest.mock('../services/salesAi/salesAiOrchestrator', () => ({
  runSalesAiChat: jest.fn(async () => ({
    reply: '## Summary\nMock sales AI reply.',
    sections: [
      { title: 'Market signals', agent: 'marketResearch', sources: [{ title: 'Example', url: 'https://example.com' }] },
      { title: 'Your LoopC data', agent: 'crmInsight' },
      { title: 'Recommendations', agent: 'strategy' },
    ],
    meta: { tenant: 'loopc', model: 'gpt-4o-mini' },
  })),
  getSalesAiConfig: jest.fn(() => ({
    enabled: true,
    tenantScope: 'loopc',
    providers: { openai: { configured: true }, tavily: { configured: true } },
    model: 'gpt-4o-mini',
    quickActions: [],
  })),
}))

const createApp = require('../app')
const User = require('../models/User')
const { runSalesAiChat } = require('../services/salesAi/salesAiOrchestrator')

let mongo
let app

const TEST_TENANT = 'loopc'
const tokenFor = (user, tenant = TEST_TENANT) => jwt.sign(
  { id: user._id.toString(), company: tenant },
  process.env.JWT_SECRET,
)

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
  process.env.SALES_AI_CHAT_RATE_LIMIT_MAX = '100000'
  process.env.SALES_AI_ALLOWED_TENANTS = 'loopc'
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
  await User.deleteMany({})
  jest.clearAllMocks()
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('Sales AI routes', () => {
  test('GET /api/sales-ai/config requires authentication', async () => {
    const res = await request(app).get('/api/sales-ai/config')
    expect(res.status).toBe(401)
  })

  test('GET /api/sales-ai/config returns config for loopc user', async () => {
    const user = await createUser()
    const res = await request(app)
      .get('/api/sales-ai/config')
      .set('Authorization', `Bearer ${tokenFor(user, 'loopc')}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.tenant).toBe('loopc')
    expect(res.body.enabled).toBe(true)
  })

  test('GET /api/sales-ai/config returns 403 for non-loopc tenant', async () => {
    const user = await createUser()
    const res = await request(app)
      .get('/api/sales-ai/config')
      .set('Authorization', `Bearer ${tokenFor(user, 'mg')}`)

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })

  test('POST /api/sales-ai/chat returns structured reply for loopc user', async () => {
    const user = await createUser()
    const res = await request(app)
      .post('/api/sales-ai/chat')
      .set('Authorization', `Bearer ${tokenFor(user, 'loopc')}`)
      .send({ message: 'Analyze our pipeline' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.reply).toMatch(/Mock sales AI reply/)
    expect(Array.isArray(res.body.sections)).toBe(true)
    expect(runSalesAiChat).toHaveBeenCalled()
  })

  test('POST /api/sales-ai/chat returns 403 for mg tenant', async () => {
    const user = await createUser()
    const res = await request(app)
      .post('/api/sales-ai/chat')
      .set('Authorization', `Bearer ${tokenFor(user, 'mg')}`)
      .send({ message: 'Market trends' })

    expect(res.status).toBe(403)
    expect(runSalesAiChat).not.toHaveBeenCalled()
  })
})
