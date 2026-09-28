const request = require('supertest')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const {
  startMongoMemoryServer,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')

const createApp = require('../app')
const User = require('../models/User')

let mongo
let app

const HOST = 'api.loopcstrategies.com'
const TENANTS = ['loopc', 'mg', 'cg', 'vb']
const BASE = '/api/erp/production-control/operations-entries'

function withDbName(uri, dbName) {
  const parsed = new URL(uri)
  parsed.pathname = `/${dbName}`
  return parsed.toString()
}

let seq = 0
async function createUser(tenant, overrides = {}) {
  const TenantUser = await User.getTenantModel(tenant)
  seq += 1
  const tag = `${Date.now().toString(36)}${seq}`
  return TenantUser.create({
    name: `${tenant}-ops-${tag}`,
    email: `${tenant}-ops-${tag}@example.com`,
    password: 'password123',
    role: 'department_head',
    department: 'production',
    productionRole: 'production_manager',
    ...overrides,
  })
}

const headers = (user, tenant) => ({
  Host: HOST,
  'x-tenant': tenant,
  Authorization: `Bearer ${jwt.sign({ id: user._id.toString(), company: tenant }, process.env.JWT_SECRET)}`,
})

const entryBody = (overrides = {}) => ({
  departmentKey: 'melting',
  batchNumber: '1',
  metalIn: 1000,
  metalOut: 990,
  date: '2026-09-28',
  ...overrides,
})

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.RATE_LIMIT_MAX = '100000'
  process.env.AUTH_RATE_LIMIT_MAX = '100000'
  process.env.DEFAULT_TENANT = 'loopc'

  mongo = await startMongoMemoryServer()
  const baseUri = mongo.getUri()
  process.env.MONGO_URI = withDbName(baseUri, 'default')
  process.env.MONGO_URI_LOOPC = withDbName(baseUri, 'loopc')
  process.env.MONGO_URI_MG = withDbName(baseUri, 'mg')
  process.env.MONGO_URI_CG = withDbName(baseUri, 'cg')
  process.env.MONGO_URI_VB = withDbName(baseUri, 'vb')

  await mongoose.connect(process.env.MONGO_URI_LOOPC)
  app = createApp()
}, 120000)

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
}, 60000)

describe('Operations → Production workbook for every tenant', () => {
  test.each(TENANTS)('%s: create, list, edit and delete a workbook row', async (tenant) => {
    const manager = await createUser(tenant)
    const h = headers(manager, tenant)

    const created = await request(app).post(BASE).set(h).send(entryBody({ batchNumber: `${tenant}-1` }))
    expect(created.status).toBe(201)
    expect(created.body.entry).toMatchObject({ departmentKey: 'melting', metalIn: 1000, metalOut: 990, metalLoss: 10 })

    const listed = await request(app).get(BASE).set(h)
    expect(listed.status).toBe(200)
    expect(listed.body.entries.map((e) => e.batchNumber)).toContain(`${tenant}-1`)

    const patched = await request(app).patch(`${BASE}/${created.body.entry._id}`).set(h).send({ employeeName: 'Ravi' })
    expect(patched.status).toBe(200)
    expect(patched.body.entry.employeeName).toBe('Ravi')

    const removed = await request(app).delete(`${BASE}/${created.body.entry._id}`).set(h)
    expect(removed.status).toBe(200)
  })

  test('each tenant only sees its own workbook rows', async () => {
    const mgManager = await createUser('mg')
    const cgManager = await createUser('cg')
    await request(app).post(BASE).set(headers(mgManager, 'mg')).send(entryBody({ batchNumber: 'mg-only' })).expect(201)
    await request(app).post(BASE).set(headers(cgManager, 'cg')).send(entryBody({ batchNumber: 'cg-only' })).expect(201)

    const mgList = await request(app).get(BASE).set(headers(mgManager, 'mg')).expect(200)
    const cgList = await request(app).get(BASE).set(headers(cgManager, 'cg')).expect(200)
    const mgBatches = mgList.body.entries.map((e) => e.batchNumber)
    const cgBatches = cgList.body.entries.map((e) => e.batchNumber)

    expect(mgBatches).toContain('mg-only')
    expect(mgBatches).not.toContain('cg-only')
    expect(cgBatches).toContain('cg-only')
    expect(cgBatches).not.toContain('mg-only')
  })

  test('operators can view but not add rows', async () => {
    const operator = await createUser('vb', { role: 'department_user', productionRole: 'operator' })
    const h = headers(operator, 'vb')
    await request(app).get(BASE).set(h).expect(200)
    const denied = await request(app).post(BASE).set(h).send(entryBody())
    expect(denied.status).toBe(403)
  })

  test('requires a signed-in user', async () => {
    const res = await request(app).get(BASE).set({ Host: HOST, 'x-tenant': 'mg' })
    expect(res.status).toBe(401)
  })
})
