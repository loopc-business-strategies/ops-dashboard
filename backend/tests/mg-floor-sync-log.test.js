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
const OLD_DAY = '2026-09-28'
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
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

/** A batch the tablet queued offline at savedAt and sends now through /sync. */
const offlineBatch = (n, { savedAt, entryDate, qty = 1000, direction = 'IN', batchLabel = String(n) }) => ({
  operationId: `be_be_sync_${n}_${Date.now().toString(36)}`,
  operationType: 'batch_entry',
  deviceId: 'tab-melting-1',
  clientTimestamp: savedAt,
  payload: {
    entryId: `be_sync_${n}_${Date.now().toString(36)}`,
    direction,
    department: 'melting',
    batchLabel,
    entryDate,
    tzOffsetMinutes: 240,
    deviceId: 'tab-melting-1',
    lines: [{ metal: 'Gold', qty, purity: 99.5, time: '08:00' }],
  },
})

const log = (user, query) => request(app).get('/api/mg-floor/sync-log').query({ from: OLD_DAY, to: today(), ...query }).set(headers(user))

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
  const models = ['FloorSyncOperation', 'FloorBatchEntry', 'FloorDevice', 'OperationsProductionEntry', 'AuditLog', 'User']
  await Promise.all(models.map(async (name) => (await require(`../models/${name}`).getTenantModel('mg')).deleteMany({})))
}, 60000)

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
}, 60000)

describe('MG Floor offline sync log', () => {
  test('lists offline batches with who, how late, and which failed', async () => {
    const fm = await createUser({ name: 'FM Sync', role: 'department_head', productionRole: 'floor_manager' })
    const op = await createUser({ name: 'Op Offline', floorDepartment: 'melting' })
    await request(app).post('/api/mg-floor/devices/register').set(headers(op)).send({ deviceId: 'tab-melting-1', appVersion: '1.4.0' })

    const late = offlineBatch(1, { savedAt: `${OLD_DAY}T08:00:00+04:00`, entryDate: OLD_DAY })
    const quick = offlineBatch(2, { savedAt: new Date().toISOString(), entryDate: today() })
    const broken = offlineBatch(3, { savedAt: new Date().toISOString(), entryDate: today(), qty: 0 })
    const sync = await request(app).post('/api/mg-floor/sync').set(headers(op)).send({ operations: [late, quick, broken] })
    expect(sync.status).toBe(200)
    expect(sync.body.results.map((r) => r.syncStatus)).toEqual(['SYNCED', 'SYNCED', 'FAILED'])

    expect((await log(op)).status).toBe(403)

    const res = await log(fm)
    expect(res.status).toBe(200)
    expect(res.body.summary).toMatchObject({ total: 3, synced: 2, problems: 1, late: 1, arrivedLaterDay: 1 })
    const byBatch = Object.fromEntries(res.body.items.map((i) => [i.batchLabel, i]))
    expect(byBatch['1']).toMatchObject({
      status: 'SYNCED',
      late: true,
      arrivedLaterDay: true,
      operator: 'Op Offline',
      department: 'melting',
      direction: 'IN',
      entryDate: OLD_DAY,
      weight: 1000,
      batchStatus: 'PENDING',
      appVersion: '1.4.0',
    })
    expect(byBatch['1'].delayMinutes).toBeGreaterThan(60)
    expect(byBatch['2']).toMatchObject({ status: 'SYNCED', late: false, arrivedLaterDay: false })
    expect(byBatch['3']).toMatchObject({ status: 'FAILED', operator: 'Op Offline', batchStatus: '', delayMinutes: null })
    expect(byBatch['3'].errorMessage).toMatch(/Enter a quantity/)

    const problems = await log(fm, { status: 'problem' })
    expect(problems.body.items.map((i) => i.batchLabel)).toEqual(['3'])
    expect((await log(fm, { department: 'rolling' })).body.items).toHaveLength(0)
    expect((await log(fm, { from: today(), to: today() })).body.items.map((i) => i.batchLabel).sort()).toEqual(['2', '3'])
    expect((await log(fm, { from: '2026-01-01', to: '2026-06-30' })).status).toBe(400)
    expect((await log(fm, { status: 'odd' })).status).toBe(400)
  })
})
