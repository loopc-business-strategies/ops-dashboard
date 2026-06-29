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
const DepartmentState = require('../models/DepartmentState')

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
  await Promise.all([User.deleteMany({}), DepartmentState.deleteMany({})])
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('Department state routes', () => {
  test('GET /api/department-state/finance requires authentication', async () => {
    const res = await request(app).get('/api/department-state/finance')
    expect(res.status).toBe(401)
  })

  test('operations user cannot read finance module state', async () => {
    const ops = await createUser({ role: 'department_user', department: 'operations' })
    const res = await request(app)
      .get('/api/department-state/finance')
      .set('Authorization', `Bearer ${tokenFor(ops)}`)

    expect(res.status).toBe(403)
  })

  test('finance head can read and save finance module state', async () => {
    const financeHead = await createUser({ role: 'department_head', department: 'finance' })

    const getRes = await request(app)
      .get('/api/department-state/finance')
      .set('Authorization', `Bearer ${tokenFor(financeHead)}`)

    expect(getRes.status).toBe(200)
    expect(getRes.body.success).toBe(true)
    expect(getRes.body.module).toBe('finance')

    const putRes = await request(app)
      .put('/api/department-state/finance')
      .set('Authorization', `Bearer ${tokenFor(financeHead)}`)
      .send({ state: { tab: 'invoices', filters: { status: 'open' } } })

    expect(putRes.status).toBe(200)
    expect(putRes.body.success).toBe(true)
    expect(putRes.body.state.tab).toBe('invoices')
  })
})
