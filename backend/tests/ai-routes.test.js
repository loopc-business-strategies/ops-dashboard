jest.mock('../services/aiAgentService', () => ({
  runAgentChat: jest.fn(async () => ({
    reply: 'Builtin agent reply',
    intent: 'capabilities',
    mode: 'builtin',
    provider: 'builtin',
    providerLabel: 'Builtin',
    model: null,
    error: false,
    contextUsed: {},
  })),
  getAiAgentConfig: jest.fn(() => ({
    provider: 'builtin',
    openAiConfigured: false,
    defaultProvider: 'builtin',
    models: ['gpt-4o-mini'],
  })),
}))

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
const { runAgentChat } = require('../services/aiAgentService')

let mongo
let app

const TEST_TENANT = 'loopc'
const tokenFor = (user) => jwt.sign({ id: user._id.toString(), company: TEST_TENANT }, process.env.JWT_SECRET)

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
  process.env.AI_CHAT_RATE_LIMIT_MAX = '100000'
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

describe('AI routes', () => {
  test('GET /api/ai/config requires authentication', async () => {
    const res = await request(app).get('/api/ai/config')
    expect(res.status).toBe(401)
  })

  test('authenticated user can read AI config', async () => {
    const user = await createUser()
    const res = await request(app)
      .get('/api/ai/config')
      .set('Authorization', `Bearer ${tokenFor(user)}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.uploads?.enabled).toBe(true)
  })

  test('POST /api/ai/chat returns agent reply', async () => {
    const user = await createUser()
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ message: 'What can you do?' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.reply).toBe('Builtin agent reply')
    expect(runAgentChat).toHaveBeenCalled()
  })
})
