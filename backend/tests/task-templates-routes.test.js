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
const TaskTemplate = require('../models/TaskTemplate')

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
  await Promise.all([User.deleteMany({}), TaskTemplate.deleteMany({})])
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('Task template routes', () => {
  test('GET /api/task-templates requires authentication', async () => {
    const res = await request(app).get('/api/task-templates')
    expect(res.status).toBe(401)
  })

  test('management user cannot create task templates', async () => {
    const mgmt = await createUser({ role: 'management', department: 'management' })
    const res = await request(app)
      .post('/api/task-templates')
      .set('Authorization', `Bearer ${tokenFor(mgmt)}`)
      .send({ name: 'Blocked template' })

    expect(res.status).toBe(403)
  })

  test('operations user can list and create templates', async () => {
    const ops = await createUser({ role: 'department_user', department: 'operations' })

    const listRes = await request(app)
      .get('/api/task-templates')
      .set('Authorization', `Bearer ${tokenFor(ops)}`)

    expect(listRes.status).toBe(200)
    expect(listRes.body.success).toBe(true)
    expect(Array.isArray(listRes.body.templates)).toBe(true)

    const createRes = await request(app)
      .post('/api/task-templates')
      .set('Authorization', `Bearer ${tokenFor(ops)}`)
      .send({
        name: 'Daily ops checklist',
        defaults: { title: 'Review queue', priority: 'medium' },
      })

    expect(createRes.status).toBe(201)
    expect(createRes.body.success).toBe(true)
    expect(createRes.body.template.name).toBe('Daily ops checklist')
  })
})
