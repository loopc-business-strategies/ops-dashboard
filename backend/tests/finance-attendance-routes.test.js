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
const FinanceInvoice = require('../models/FinanceInvoice')
const AttendanceRecord = require('../models/AttendanceRecord')

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
    FinanceInvoice.deleteMany({}),
    AttendanceRecord.deleteMany({}),
  ])
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('Finance and attendance route guards', () => {
  test('finance head can list invoices', async () => {
    const financeHead = await createUser({ role: 'department_head', department: 'finance' })

    const res = await request(app)
      .get('/api/finance/invoices')
      .set('Authorization', `Bearer ${tokenFor(financeHead)}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  test('operations user cannot create finance invoices', async () => {
    const opsUser = await createUser({ role: 'department_user', department: 'operations' })

    const res = await request(app)
      .post('/api/finance/invoices')
      .set('Authorization', `Bearer ${tokenFor(opsUser)}`)
      .send({
        client: 'Acme Corp',
        amount: 1000,
        invoiceType: 'Sales',
      })

    expect(res.status).toBe(403)
  })

  test('HR head can list attendance records', async () => {
    const hrHead = await createUser({ role: 'department_head', department: 'hr' })

    const res = await request(app)
      .get('/api/attendance/records')
      .set('Authorization', `Bearer ${tokenFor(hrHead)}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.records)).toBe(true)
  })

  test('operations user cannot create attendance records for other departments', async () => {
    const opsUser = await createUser({ role: 'department_user', department: 'operations' })

    const res = await request(app)
      .post('/api/attendance/records')
      .set('Authorization', `Bearer ${tokenFor(opsUser)}`)
      .send({
        employeeName: 'Someone Else',
        department: 'finance',
        status: 'present',
      })

    expect(res.status).toBe(403)
  })
})
