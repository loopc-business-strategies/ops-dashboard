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
  phone: '+998 90 123 45 67',
  source: 'website',
  enquiryType: 'sell_gold',
}
const { buildEnquiryRows } = jest.requireActual('../services/websiteEnquiryEmail')

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

const submit = (body = PAYLOAD, token = ENQUIRY_TOKEN, idempotencyKey = '') => {
  const req = request(app).post('/api/enquiries')
  if (token) req.set('x-website-enquiry-token', token)
  if (idempotencyKey) req.set('Idempotency-Key', idempotencyKey)
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
    const missingPhone = await submit({ name: 'No Phone' })
    expect(missingPhone.status).toBe(400)
    const badType = await submit({ ...PAYLOAD, enquiryType: 'Unknown' })
    expect(badType.status).toBe(400)
    const clientStatus = await submit({ ...PAYLOAD, status: 'WON' })
    expect(clientStatus.status).toBe(400)
    const TenantEnquiry = await WebsiteEnquiry.getTenantModel(TEST_TENANT)
    expect(await TenantEnquiry.countDocuments({})).toBe(0)
  })

  test('name + phone only saves one Sell Gold / website / NEW record without empty optional fields', async () => {
    const res = await submit({ ...PAYLOAD, status: 'new' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.id).toBeTruthy()

    const TenantEnquiry = await WebsiteEnquiry.getTenantModel(TEST_TENANT)
    const docs = await TenantEnquiry.find({}).lean()
    expect(docs).toHaveLength(1)
    const [doc] = docs
    expect(doc.name).toBe(PAYLOAD.name)
    expect(doc.phone).toBe(PAYLOAD.phone)
    expect(doc.enquiryType).toBe('Sell Gold')
    expect(doc.source).toBe('website')
    expect(doc.status).toBe('NEW')
    expect(doc.createdAt).toBeTruthy()
    expect(doc.updatedAt).toBeTruthy()
    for (const field of ['email', 'company', 'requirement', 'message']) {
      expect(doc).not.toHaveProperty(field)
    }
    expect(sendWebsiteEnquiryNotification).toHaveBeenCalledTimes(1)
  })

  test('enquiryType defaults to Sell Gold and optional fields are kept when sent', async () => {
    const res = await submit({
      name: 'Full Customer',
      phone: '+998 91 222 33 44',
      company: 'Test Gold LLC',
      email: 'customer@example.com',
      requirement: '200g 22K chains',
      message: 'Morning call please',
    })
    expect(res.status).toBe(201)
    const TenantEnquiry = await WebsiteEnquiry.getTenantModel(TEST_TENANT)
    const doc = await TenantEnquiry.findById(res.body.id).lean()
    expect(doc.enquiryType).toBe('Sell Gold')
    expect(doc.company).toBe('Test Gold LLC')
    expect(doc.email).toBe('customer@example.com')
  })

  test('the same Idempotency-Key returns the same record', async () => {
    const key = '3f2b8c1e-1d2a-4b6c-9e7f-0a1b2c3d4e5f'
    const first = await submit(PAYLOAD, ENQUIRY_TOKEN, key)
    const retry = await submit({ ...PAYLOAD, phone: '+998 99 000 11 22' }, ENQUIRY_TOKEN, key)
    expect(first.status).toBe(201)
    expect(retry.status).toBe(200)
    expect(retry.body.duplicate).toBe(true)
    expect(String(retry.body.id)).toBe(String(first.body.id))
    const TenantEnquiry = await WebsiteEnquiry.getTenantModel(TEST_TENANT)
    expect(await TenantEnquiry.countDocuments({})).toBe(1)
    expect(sendWebsiteEnquiryNotification).toHaveBeenCalledTimes(1)
  })

  test('simultaneous submissions (double-click) create only one record', async () => {
    const key = 'bbbbbbbb-0000-0000-0000-000000000001'
    const results = await Promise.all([
      submit(PAYLOAD, ENQUIRY_TOKEN, key),
      submit(PAYLOAD, ENQUIRY_TOKEN, key),
      submit(PAYLOAD, ENQUIRY_TOKEN),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 200, 201])
    expect(new Set(results.map((r) => String(r.body.id))).size).toBe(1)
    const TenantEnquiry = await WebsiteEnquiry.getTenantModel(TEST_TENANT)
    expect(await TenantEnquiry.countDocuments({})).toBe(1)
    expect(sendWebsiteEnquiryNotification).toHaveBeenCalledTimes(1)
  })

  test('a repeat submission with the same phone within the window is de-duplicated', async () => {
    const first = await submit(PAYLOAD, ENQUIRY_TOKEN, 'aaaaaaaa-0000-0000-0000-000000000001')
    const again = await submit({ ...PAYLOAD, phone: '+998901234567' }, ENQUIRY_TOKEN, 'aaaaaaaa-0000-0000-0000-000000000002')
    expect(first.status).toBe(201)
    expect(again.status).toBe(200)
    expect(String(again.body.id)).toBe(String(first.body.id))
    const other = await submit({ ...PAYLOAD, phone: '+998 93 555 66 77' })
    expect(other.status).toBe(201)
    const TenantEnquiry = await WebsiteEnquiry.getTenantModel(TEST_TENANT)
    expect(await TenantEnquiry.countDocuments({})).toBe(2)
  })
})

describe('Website enquiry notification email', () => {
  test('lists name, phone, type, source and date, and skips missing optional fields', () => {
    const rows = buildEnquiryRows({
      name: 'Test Customer',
      phone: '+998 90 123 45 67',
      enquiryType: 'Sell Gold',
      source: 'website',
      createdAt: new Date('2026-10-06T08:00:00Z'),
    })
    expect(rows.map(([label]) => label)).toEqual(['Name', 'Phone', 'Enquiry Type', 'Source', 'Date/Time'])
    expect(rows.find(([label]) => label === 'Source')[1]).toBe('WEBSITE')

    const withEmail = buildEnquiryRows({ name: 'A', phone: '1', enquiryType: 'Sell Gold', email: 'a@b.c' })
    expect(withEmail.map(([label]) => label)).toContain('Email')
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
