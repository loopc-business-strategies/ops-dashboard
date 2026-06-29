jest.mock('../services/reportDigestService', () => ({
  buildReportDigestText: jest.fn(async () => 'Sample digest text for tests'),
}))

jest.mock('../services/notificationDispatch', () => ({
  notifyUsers: jest.fn(async () => ({ delivered: 1, skipped: 0 })),
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
const { buildReportDigestText } = require('../services/reportDigestService')
const { notifyUsers } = require('../services/notificationDispatch')

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
  jest.clearAllMocks()
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('Notifications routes', () => {
  test('POST /api/notifications/report-digest/preview requires authentication', async () => {
    const res = await request(app).post('/api/notifications/report-digest/preview')
    expect(res.status).toBe(401)
  })

  test('authenticated user can preview report digest', async () => {
    const user = await createUser({ role: 'department_head', department: 'finance' })
    const res = await request(app)
      .post('/api/notifications/report-digest/preview')
      .set('Authorization', `Bearer ${tokenFor(user)}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.text).toBe('Sample digest text for tests')
    expect(buildReportDigestText).toHaveBeenCalled()
  })

  test('authenticated user can send report digest', async () => {
    const user = await createUser({ role: 'department_head', department: 'finance' })
    const res = await request(app)
      .post('/api/notifications/report-digest/send')
      .set('Authorization', `Bearer ${tokenFor(user)}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(notifyUsers).toHaveBeenCalled()
  })
})
