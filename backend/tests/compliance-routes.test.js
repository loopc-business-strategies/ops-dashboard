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
const { ComplianceEligibility } = require('../models/ComplianceModels')

let mongo
let app

const TEST_TENANT = 'loopc'
const tokenFor = (user) => jwt.sign({ id: user._id.toString(), company: TEST_TENANT }, process.env.JWT_SECRET)

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
    (async () => {
      const Model = await ComplianceEligibility.getTenantModel(TEST_TENANT)
      await Model.deleteMany({})
    })(),
  ])
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('Compliance routes', () => {
  test('GET /api/compliance/eligibility requires authentication', async () => {
    const res = await request(app).get('/api/compliance/eligibility')
    expect(res.status).toBe(401)
  })

  test('department user cannot POST compliance eligibility', async () => {
    const opsUser = await createUser({ role: 'department_user', department: 'operations' })

    const res = await request(app)
      .post('/api/compliance/eligibility')
      .set('Authorization', `Bearer ${tokenFor(opsUser)}`)
      .send({ entity: 'Acme LLC', permit: 'EXP-1' })

    expect(res.status).toBe(403)
  })

  test('compliance writer can list and create eligibility records', async () => {
    const govHead = await createUser({ role: 'department_head', department: 'government' })

    const listRes = await request(app)
      .get('/api/compliance/eligibility')
      .set('Authorization', `Bearer ${tokenFor(govHead)}`)

    expect(listRes.status).toBe(200)
    expect(listRes.body.success).toBe(true)
    expect(Array.isArray(listRes.body.data)).toBe(true)

    const createRes = await request(app)
      .post('/api/compliance/eligibility')
      .set('Authorization', `Bearer ${tokenFor(govHead)}`)
      .send({ entity: 'Acme LLC', permit: 'EXP-1', status: 'active' })

    expect(createRes.status).toBe(201)
    expect(createRes.body.success).toBe(true)
    expect(createRes.body.data.entity).toBe('Acme LLC')
  })
})
