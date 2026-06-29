const fs = require('fs')
const os = require('os')
const path = require('path')
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
const CrmContact = require('../models/CrmContact')

jest.setTimeout(120000)

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
  process.env.CRM_CONTACT_UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-docs-'))

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
  await CrmContact.deleteMany({})
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
  if (process.env.CRM_CONTACT_UPLOAD_DIR) {
    fs.rmSync(process.env.CRM_CONTACT_UPLOAD_DIR, { recursive: true, force: true })
  }
})

describe('CRM API access', () => {
  test('sales department head can list contacts', async () => {
    const head = await createUser({ role: 'department_head', department: 'sales', name: 'Sales Head' })
    const res = await request(app)
      .get('/api/crm/contacts')
      .set('Authorization', `Bearer ${tokenFor(head)}`)
      .set('x-tenant', TEST_TENANT)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  test('non-sales user is denied CRM contacts', async () => {
    const ops = await createUser({ role: 'department_user', department: 'operations', name: 'Ops User' })
    const res = await request(app)
      .get('/api/crm/contacts')
      .set('Authorization', `Bearer ${tokenFor(ops)}`)
      .set('x-tenant', TEST_TENANT)

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })

  test('sales head can create a contact', async () => {
    const head = await createUser({ role: 'department_head', department: 'sales', name: 'Sales Head 2' })
    const res = await request(app)
      .post('/api/crm/contacts')
      .set('Authorization', `Bearer ${tokenFor(head)}`)
      .set('x-tenant', TEST_TENANT)
      .send({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        country: 'UK',
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data?.firstName).toBe('Ada')
  })

  test('sales rep cannot create a contact', async () => {
    const rep = await createUser({ role: 'department_user', department: 'sales', name: 'Sales Rep' })
    const res = await request(app)
      .post('/api/crm/contacts')
      .set('Authorization', `Bearer ${tokenFor(rep)}`)
      .set('x-tenant', TEST_TENANT)
      .send({
        firstName: 'Grace',
        lastName: 'Hopper',
      })

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })

  test('contact patch rejects server-owned fields', async () => {
    const head = await createUser({ role: 'department_head', department: 'sales', name: 'Sales Head 3' })
    const createRes = await request(app)
      .post('/api/crm/contacts')
      .set('Authorization', `Bearer ${tokenFor(head)}`)
      .set('x-tenant', TEST_TENANT)
      .send({ firstName: 'Alan', lastName: 'Turing' })

    const contactId = createRes.body.data._id
    const patchRes = await request(app)
      .put(`/api/crm/contacts/${contactId}`)
      .set('Authorization', `Bearer ${tokenFor(head)}`)
      .set('x-tenant', TEST_TENANT)
      .send({ isDeleted: true, createdBy: new mongoose.Types.ObjectId().toString() })

    expect(patchRes.status).toBe(400)
  })

  test('protected CRM document download requires authentication', async () => {
    const head = await createUser({ role: 'department_head', department: 'sales', name: 'Sales Head 4' })
    const createRes = await request(app)
      .post('/api/crm/contacts')
      .set('Authorization', `Bearer ${tokenFor(head)}`)
      .set('x-tenant', TEST_TENANT)
      .send({ firstName: 'Doc', lastName: 'Owner' })

    const contactId = createRes.body.data._id
    const uploadRes = await request(app)
      .post(`/api/crm/contacts/${contactId}/documents`)
      .set('Authorization', `Bearer ${tokenFor(head)}`)
      .set('x-tenant', TEST_TENANT)
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'kyc.pdf', contentType: 'application/pdf' })

    expect(uploadRes.status).toBe(201)
    const docId = uploadRes.body.data.kyc.documents[0]._id

    const unauth = await request(app)
      .get(`/api/crm/contacts/${contactId}/documents/${docId}/download`)

    expect(unauth.status).toBe(401)

    const authed = await request(app)
      .get(`/api/crm/contacts/${contactId}/documents/${docId}/download`)
      .set('Authorization', `Bearer ${tokenFor(head)}`)
      .set('x-tenant', TEST_TENANT)

    expect(authed.status).toBe(200)
    expect(authed.headers['content-type']).toMatch(/pdf/i)
  })
})
