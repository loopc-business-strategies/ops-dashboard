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

let mongo
let app

const HOST = 'api.loopcstrategies.com'
const tokenFor = (user, tenant) => jwt.sign({ id: user._id.toString(), company: tenant }, process.env.JWT_SECRET)

function withDbName(uri, dbName) {
  const parsed = new URL(uri)
  parsed.pathname = `/${dbName}`
  return parsed.toString()
}

let seq = 0
const createUser = async (overrides = {}) => {
  const TenantUser = await User.getTenantModel('mg')
  seq += 1
  const tag = `${Date.now().toString(36)}${seq}`
  return TenantUser.create({
    name: `mg-user-${tag}`,
    email: `mg-user-${tag}@example.com`,
    password: 'password123',
    role: 'department_user',
    department: 'production',
    productionRole: 'operator',
    ...overrides,
  })
}

const headers = (user) => ({
  Host: HOST,
  'x-tenant': 'mg',
  Authorization: `Bearer ${tokenFor(user, 'mg')}`,
})

const report = (user) => request(app).post('/api/mg-floor/breakdowns').set(headers(user)).send({ department: 'melting' })
const current = (user) => request(app).get('/api/mg-floor/breakdowns/current').query({ department: 'melting' }).set(headers(user))
const unfixed = (user) => request(app).get('/api/mg-floor/breakdowns/unfixed').set(headers(user))
const fix = (user, id, note) => request(app).post(`/api/mg-floor/breakdowns/${id}/fixed`).set(headers(user)).send(note == null ? {} : { note })

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

  await mongoose.connect(process.env.MONGO_URI_MG)
  app = createApp()
  process.env.NODE_ENV = 'test'
}, 120000)

afterEach(async () => {
  if (!isMongooseConnected(mongoose)) return
  const models = ['ProductionAlert', 'AuditLog', 'User']
  await Promise.all(models.map(async (name) => (await require(`../models/${name}`).getTenantModel('mg')).deleteMany({})))
}, 60000)

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
}, 60000)

describe('MG Floor breakdown fixed', () => {
  test('reported, acknowledged, fixed from the tablet with a note; downtime and audit; F.M pressing late is fine', async () => {
    const op = await createUser({ name: 'Op Melt', floorDepartment: 'melting' })
    const fm = await createUser({ name: 'FM Fix', role: 'department_head', productionRole: 'floor_manager' })

    const raised = await report(op)
    expect(raised.status).toBe(201)
    const id = raised.body.alert._id
    expect((await current(op)).body.alert).toMatchObject({ _id: id, status: 'OPEN', downtimeMinutes: null })

    expect((await request(app).post(`/api/mg-floor/breakdowns/${id}/acknowledge`).set(headers(fm))).status).toBe(200)
    const again = await report(op)
    expect(again.status).toBe(200)
    expect(again.body).toMatchObject({ reused: true, alert: { _id: id, status: 'ACKNOWLEDGED' } })

    expect((await unfixed(op)).status).toBe(403)
    expect((await unfixed(fm)).body.breakdowns.map((b) => b._id)).toEqual([id])

    const Alert = await require('../models/ProductionAlert').getTenantModel('mg')
    await Alert.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { createdAt: new Date(Date.now() - 40 * 60000) } })

    const fixed = await fix(op, id, '  Belt replaced  ')
    expect(fixed.status).toBe(200)
    expect(fixed.body).toMatchObject({
      alreadyFixed: false,
      alert: { status: 'RESOLVED', resolvedByName: 'Op Melt', fixNote: 'Belt replaced', downtimeMinutes: 40 },
    })

    const late = await fix(fm, id)
    expect(late.status).toBe(200)
    expect(late.body).toMatchObject({ alreadyFixed: true, alert: { resolvedByName: 'Op Melt' } })
    expect((await request(app).post(`/api/mg-floor/breakdowns/${id}/acknowledge`).set(headers(fm))).body.alert.status).toBe('RESOLVED')

    expect((await current(op)).body.alert).toBeNull()
    expect((await unfixed(fm)).body.breakdowns).toEqual([])

    const AuditLog = await require('../models/AuditLog').getTenantModel('mg')
    const audit = await AuditLog.findOne({ action: 'mg_floor_breakdown_fixed' }).lean()
    expect(audit.changes).toMatchObject({ department: 'melting', downtimeMinutes: 40, note: 'Belt replaced', fixedByName: 'Op Melt' })

    const next = await report(op)
    expect(next.status).toBe(201)
    expect(next.body.alert._id).not.toBe(id)
  })

  test('breakdowns from before "Fixed" existed are not treated as machines still down', async () => {
    const op = await createUser({ floorDepartment: 'melting' })
    const fm = await createUser({ role: 'department_head', productionRole: 'floor_manager' })
    const Alert = await require('../models/ProductionAlert').getTenantModel('mg')
    await Alert.collection.insertOne({
      alertNumber: 'BD-OLD-1',
      category: 'machine',
      code: 'MACHINE_BREAKDOWN',
      title: 'Breakdown — Melting',
      severity: 'critical',
      status: 'ACKNOWLEDGED',
      metadata: { department: 'melting', source: 'mg-floor' },
      createdAt: new Date(Date.now() - 3600000),
    })

    expect((await current(op)).body.alert).toBeNull()
    expect((await unfixed(fm)).body.breakdowns).toEqual([])
    const raised = await report(op)
    expect(raised.status).toBe(201)
    expect(await Alert.findById(raised.body.alert._id).lean()).toMatchObject({ metadata: { trackFix: true } })
    expect((await fix(op, '0123456789abcdef01234567')).status).toBe(404)
    expect((await fix(op, raised.body.alert._id, 'x'.repeat(301))).status).toBe(400)
  })
})
