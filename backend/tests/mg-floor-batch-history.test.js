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
const DAY = '2026-09-28'
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

let entrySeq = 0
async function send(op, { department = 'melting', batchLabel, direction, qty }) {
  entrySeq += 1
  const res = await request(app).post('/api/mg-floor/batch-entries').set(headers(op)).send({
    entryId: `be_hist_${Date.now().toString(36)}_${entrySeq}`,
    direction,
    department,
    batchLabel,
    entryDate: DAY,
    tzOffsetMinutes: 240,
    lines: [{ metal: 'Gold', qty, purity: 99.5, time: direction === 'IN' ? '08:00' : '10:00' }],
  })
  expect(res.status).toBe(201)
  return res.body.entry
}
const decide = async (fm, entry, action, reason) => {
  const res = await request(app).post(`/api/mg-floor/batch-entries/${entry._id}/${action}`).set(headers(fm)).send(reason ? { reason } : {})
  expect(res.status).toBe(200)
}
const history = (user, query) => request(app).get('/api/mg-floor/batch-history').query({ from: DAY, to: DAY, ...query }).set(headers(user))

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
  const models = ['FloorBatchEntry', 'OperationsProductionEntry', 'AuditLog', 'User']
  await Promise.all(models.map(async (name) => (await require(`../models/${name}`).getTenantModel('mg')).deleteMany({})))
}, 60000)

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
}, 60000)

describe('MG Floor batch history', () => {
  test('full story per batch: rejected, resent, approved, undone, resent; filters keep the whole batch', async () => {
    const fm = await createUser({ name: 'FM Hist', role: 'department_head', productionRole: 'floor_manager' })
    const op1 = await createUser({ name: 'Op One', floorDepartment: 'melting' })
    const op2 = await createUser({ name: 'Op Two', floorDepartment: 'melting' })
    const rollingOp = await createUser({ name: 'Op Rolling', floorDepartment: 'rolling' })

    await decide(fm, await send(op1, { batchLabel: '1', direction: 'IN', qty: 1000 }), 'reject', 'Recheck the weight')
    await decide(fm, await send(op1, { batchLabel: '1', direction: 'IN', qty: 1001 }), 'approve')
    const out = await send(op1, { batchLabel: '1', direction: 'OUT', qty: 990 })
    await decide(fm, out, 'approve')
    await decide(fm, out, 'undo-approval', 'Out was 909')
    await send(op2, { batchLabel: '1', direction: 'OUT', qty: 991 })

    await decide(fm, await send(op1, { batchLabel: '2', direction: 'IN', qty: 500 }), 'approve')
    await decide(fm, await send(op1, { batchLabel: '2', direction: 'OUT', qty: 498 }), 'approve')
    await send(rollingOp, { department: 'rolling', batchLabel: '1', direction: 'IN', qty: 200 })

    expect((await history(op1, {})).status).toBe(403)

    const all = await history(fm, { department: 'melting' })
    expect(all.status).toBe(200)
    expect(all.body.batches.map((b) => b.batchLabel).sort()).toEqual(['1', '2'])
    const one = all.body.batches.find((b) => b.batchLabel === '1')
    expect(one).toMatchObject({
      department: 'melting',
      status: 'waiting',
      timesSent: 4,
      loss: null,
      metalIn: { status: 'APPROVED', weight: 1001, times: 2 },
      metalOut: { status: 'PENDING', weight: 991, times: 2, by: 'Op Two' },
    })
    expect(one.events.map((e) => `${e.type} ${e.direction}`)).toEqual([
      'sent IN', 'rejected IN', 'sent IN', 'approved IN', 'sent OUT', 'approved OUT', 'undone OUT', 'sent OUT',
    ])
    expect(one.events[1]).toMatchObject({ by: 'FM Hist', reason: 'Recheck the weight' })
    expect(one.events[6]).toMatchObject({ by: 'FM Hist', reason: 'Out was 909' })
    expect(one.events[7]).toMatchObject({ by: 'Op Two', weight: 991 })
    expect(all.body.batches.find((b) => b.batchLabel === '2')).toMatchObject({ status: 'finished', loss: 2, lossPct: 0.4 })

    const byBatch = await history(fm, { batch: '1' })
    expect(byBatch.body.batches.map((b) => b.department).sort()).toEqual(['melting', 'rolling'])

    const byOperator = await history(fm, { operator: 'op two' })
    expect(byOperator.body.batches).toHaveLength(1)
    expect(byOperator.body.batches[0]).toMatchObject({ batchLabel: '1', timesSent: 4 })

    expect((await history(fm, { operator: 'nobody' })).body.batches).toEqual([])
    expect((await history(fm, { from: '2026-01-01', to: '2026-09-28' })).status).toBe(400)
  })
})
