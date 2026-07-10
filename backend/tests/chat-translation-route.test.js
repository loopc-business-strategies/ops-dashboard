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

jest.setTimeout(120000)

let mongo
let app

const TEST_TENANT = 'loopc'
const tokenFor = (user, company = TEST_TENANT) => jwt.sign({ id: user._id.toString(), company }, process.env.JWT_SECRET)

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
  process.env.DEFAULT_TENANT = TEST_TENANT
  process.env.CHAT_TRANSLATION_ALLOWED_TENANTS = 'loopc'

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
  jest.restoreAllMocks()
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('POST /api/messages/translate', () => {
  test('translates message for allowed tenant', async () => {
    const user = await createUser()
    const token = tokenFor(user)

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        responseStatus: 200,
        responseData: { translatedText: 'Salom' },
        matches: [{ match: 0.95 }],
      }),
    })

    const res = await request(app)
      .post('/api/messages/translate')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Hello', targetLang: 'uz' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.translatedText).toBe('Salom')
    expect(res.body.provider).toBe('mymemory')
  })

  test('rejects disabled tenant', async () => {
    const user = await createUser()
    const token = tokenFor(user, 'mg')

    const res = await request(app)
      .post('/api/messages/translate')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Hello', targetLang: 'uz' })

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })

  test('validates payload', async () => {
    const user = await createUser()
    const token = tokenFor(user)

    const res = await request(app)
      .post('/api/messages/translate')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: '', targetLang: 'uz' })

    expect(res.status).toBe(400)
  })
})
