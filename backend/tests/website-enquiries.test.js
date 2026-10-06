const request = require('supertest')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')

jest.mock('../services/websiteEnquiryEmail', () => ({
  sendWebsiteEnquiryNotification: jest.fn().mockResolvedValue({ skipped: true }),
}))

const { sendWebsiteEnquiryNotification } = require('../services/websiteEnquiryEmail')
const createApp = require('../app')
const User = require('../models/User')
const WebsiteEnquiry = require('../models/WebsiteEnquiry')

jest.setTimeout(120000)

const TEST_TENANT = 'mg'
const ENQUIRY_TOKEN = 'website-enquiry-test-token'
const PAYLOAD = {
  name: 'Test Customer',
  company: 'Test Gold LLC',
  email: 'customer@example.com',
  phone: '+998 90 123 45 67',
  enquiryType: 'Sell Gold',
  requirement: '200g 22K gold chains',
  message: 'Please call me in the morning.',
  source: 'website',
}

let mongo
let app

const tokenFor = (user) => jwt.sign({ id: user._id.toString(), company: TEST_TENANT }, process.env.JWT_SECRET)

const createUser = async (overrides = {}) => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  return User.create({
    name: `user-${suffix}`,
    email: `user-${suffix}@example.com`,
    password: 'password123',
    role: 'department_user',
    department: 'operations',
    ...overrides,
  })
}

const authed = (req, user) => req.set('Authorization', `Bearer ${tokenFor(user)}`).set('x-tenant', TEST_TENANT)

const submit = (body = PAYLOAD, token = ENQUIRY_TOKEN) => {
  const req = request(app).post('/api/enquiries')
  if (token) req.set('x-website-enquiry-token', token)
  return req.send(body)
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.RATE_LIMIT_MAX = '100000'
  process.env.DEFAULT_TENANT = TEST_TENANT
  process.env.WEBSITE_ENQUIRY_TOKEN = ENQUIRY_TOKEN
  process.env.WEBSITE_ENQUIRY_TENANT = TEST_TENANT

  mongo = await startMongoMemoryServer()
  const mongoUri = mongo.getUri()
  process.env.MONGO_URI = mongoUri
  process.env.MONGO_URI_MG = mongoUri
  await mongoose.connect(mongoUri)
  app = createApp()
})

afterEach(async () => {
  sendWebsiteEnquiryNotification.mockClear()
  if (!isMongooseConnected(mongoose)) return
  await User.deleteMany({})
  const TenantEnquiry = await WebsiteEnquiry.getTenantModel(TEST_TENANT)
  await TenantEnquiry.deleteMany({})
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('POST /api/enquiries (website submission)', () => {
  test('rejects a missing token', async () => {
    const res = await submit(PAYLOAD, null)
    expect(res.status).toBe(401)
  })

  test('rejects a wrong token', async () => {
    const res = await submit(PAYLOAD, 'wrong-token')
    expect(res.status).toBe(401)
  })

  test('returns 503 when the token is not configured', async () => {
    const saved = process.env.WEBSITE_ENQUIRY_TOKEN
    delete process.env.WEBSITE_ENQUIRY_TOKEN
    try {
      const res = await submit()
      expect(res.status).toBe(503)
    } finally {
      process.env.WEBSITE_ENQUIRY_TOKEN = saved
    }
  })

  test('rejects invalid data', async () => {
    const res = await submit({ ...PAYLOAD, email: 'not-an-email', enquiryType: 'Unknown' })
    expect(res.status).toBe(400)
    const TenantEnquiry = await WebsiteEnquiry.getTenantModel(TEST_TENANT)
    expect(await TenantEnquiry.countDocuments({})).toBe(0)
  })

  test('saves exactly one record with source website and status NEW, and sends the email', async () => {
    const res = await submit({ ...PAYLOAD, status: 'WON', source: 'website' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.id).toBeTruthy()

    const TenantEnquiry = await WebsiteEnquiry.getTenantModel(TEST_TENANT)
    const docs = await TenantEnquiry.find({}).lean()
    expect(docs).toHaveLength(1)
    const [doc] = docs
    expect(doc.name).toBe(PAYLOAD.name)
    expect(doc.company).toBe(PAYLOAD.company)
    expect(doc.email).toBe(PAYLOAD.email)
    expect(doc.phone).toBe(PAYLOAD.phone)
    expect(doc.enquiryType).toBe(PAYLOAD.enquiryType)
    expect(doc.requirement).toBe(PAYLOAD.requirement)
    expect(doc.message).toBe(PAYLOAD.message)
    expect(doc.source).toBe('website')
    expect(doc.status).toBe('NEW')
    expect(doc.createdAt).toBeTruthy()
    expect(sendWebsiteEnquiryNotification).toHaveBeenCalledTimes(1)
  })
})

describe('Dashboard access to website enquiries', () => {
  test('the same record is visible to Sales and Procurement, and status changes are shared', async () => {
    const created = await submit()
    const id = created.body.id

    const salesHead = await createUser({ role: 'department_head', department: 'sales', name: 'Sales Head' })
    const opsUser = await createUser({ role: 'department_user', department: 'operations', name: 'Procurement User' })

    const salesList = await authed(request(app).get('/api/enquiries'), salesHead)
    const procList = await authed(request(app).get('/api/enquiries'), opsUser)
    expect(salesList.status).toBe(200)
    expect(procList.status).toBe(200)
    expect(salesList.body.data.map((e) => String(e._id))).toEqual([String(id)])
    expect(procList.body.data.map((e) => String(e._id))).toEqual([String(id)])

    const salesUpdate = await authed(request(app).patch(`/api/enquiries/${id}/status`), salesHead).send({ status: 'CONTACTED' })
    expect(salesUpdate.status).toBe(200)
    const procView = await authed(request(app).get('/api/enquiries'), opsUser)
    expect(procView.body.data[0].status).toBe('CONTACTED')

    const procUpdate = await authed(request(app).patch(`/api/enquiries/${id}/status`), opsUser).send({ status: 'QUOTATION' })
    expect(procUpdate.status).toBe(200)
    const salesView = await authed(request(app).get('/api/enquiries'), salesHead)
    expect(salesView.body.data[0].status).toBe('QUOTATION')
    expect(salesView.body.data[0].statusHistory.map((h) => h.status)).toEqual(['NEW', 'CONTACTED', 'QUOTATION'])

    const TenantEnquiry = await WebsiteEnquiry.getTenantModel(TEST_TENANT)
    expect(await TenantEnquiry.countDocuments({})).toBe(1)
  })

  test('assigns an existing employee and lists assignees', async () => {
    const created = await submit()
    const id = created.body.id
    const salesHead = await createUser({ role: 'department_head', department: 'sales', name: 'Sales Head' })
    const rep = await createUser({ role: 'department_user', department: 'sales', name: 'Sales Rep' })
    await createUser({ role: 'department_user', department: 'hr', name: 'HR Person' })

    const assignees = await authed(request(app).get('/api/enquiries/assignees'), salesHead)
    expect(assignees.status).toBe(200)
    const names = assignees.body.data.map((a) => a.name)
    expect(names).toEqual(expect.arrayContaining(['Sales Head', 'Sales Rep']))
    expect(names).not.toContain('HR Person')

    const assigned = await authed(request(app).patch(`/api/enquiries/${id}/assign`), salesHead).send({ userId: rep._id.toString() })
    expect(assigned.status).toBe(200)
    expect(assigned.body.data.assignedToName).toBe('Sales Rep')

    const unassigned = await authed(request(app).patch(`/api/enquiries/${id}/assign`), salesHead).send({ userId: '' })
    expect(unassigned.status).toBe(200)
    expect(unassigned.body.data.assignedToName).toBe('')
  })

  test('users without Sales or Procurement access are denied', async () => {
    await submit()
    const hrUser = await createUser({ role: 'department_user', department: 'hr', name: 'HR User' })
    const res = await authed(request(app).get('/api/enquiries'), hrUser)
    expect(res.status).toBe(403)
  })

  test('unauthenticated dashboard requests are rejected', async () => {
    const res = await request(app).get('/api/enquiries').set('x-tenant', TEST_TENANT)
    expect(res.status).toBe(401)
  })
})
