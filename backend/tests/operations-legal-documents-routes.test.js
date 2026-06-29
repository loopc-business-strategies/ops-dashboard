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
const OperationsLegalFolder = require('../models/OperationsLegalFolder')

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
  await Promise.all([User.deleteMany({}), OperationsLegalFolder.deleteMany({})])
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('Operations legal document routes', () => {
  test('GET /api/operations/legal-documents/folders requires authentication', async () => {
    const res = await request(app).get('/api/operations/legal-documents/folders')
    expect(res.status).toBe(401)
  })

  test('finance user cannot list legal document folders', async () => {
    const finance = await createUser({ role: 'department_user', department: 'finance' })
    const res = await request(app)
      .get('/api/operations/legal-documents/folders')
      .set('Authorization', `Bearer ${tokenFor(finance)}`)

    expect(res.status).toBe(403)
  })

  test('operations user can list folders and operations head can create one', async () => {
    const opsUser = await createUser({ role: 'department_user', department: 'operations' })
    const listRes = await request(app)
      .get('/api/operations/legal-documents/folders')
      .set('Authorization', `Bearer ${tokenFor(opsUser)}`)

    expect(listRes.status).toBe(200)
    expect(listRes.body.success).toBe(true)
    expect(Array.isArray(listRes.body.folders)).toBe(true)

    const opsHead = await createUser({ role: 'department_head', department: 'operations' })
    const createRes = await request(app)
      .post('/api/operations/legal-documents/folders')
      .set('Authorization', `Bearer ${tokenFor(opsHead)}`)
      .send({ name: 'Contracts' })

    expect(createRes.status).toBe(201)
    expect(createRes.body.success).toBe(true)
    expect(createRes.body.folder.name).toBe('Contracts')
  })
})
