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
const createOperator = () => createUser({ productionRole: 'operator', floorDepartment: 'melting' })
const createFloorManager = () => createUser({ role: 'department_head', productionRole: 'floor_manager' })

const headers = (user) => ({
  Host: HOST,
  'x-tenant': 'mg',
  Authorization: `Bearer ${tokenFor(user, 'mg')}`,
})

let entrySeq = 0
async function sendAndApprove(op, fm, { batchLabel, direction, lines, approve = true }) {
  entrySeq += 1
  const res = await request(app).post('/api/mg-floor/batch-entries').set(headers(op)).send({
    entryId: `be_stats_${Date.now().toString(36)}_${entrySeq}`,
    direction,
    department: 'melting',
    batchLabel,
    entryDate: DAY,
    tzOffsetMinutes: 240,
    lines,
  })
  expect(res.status).toBe(201)
  if (approve) {
    const ok = await request(app).post(`/api/mg-floor/batch-entries/${res.body.entry._id}/approve`).set(headers(fm)).send({})
    expect(ok.status).toBe(200)
  }
}

const gold = (qty, time, purity = 99.5) => ({ metal: 'Gold', qty, purity, time })
const stats = (user, query = { department: 'melting', date: DAY }) =>
  request(app).get('/api/mg-floor/batch-stats').query(query).set(headers(user))
const setLimit = (user, body) => request(app).put('/api/mg-floor/batch-stats/loss-limit').set(headers(user)).send(body)

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
  const models = ['FloorBatchEntry', 'OperationsProductionEntry', 'MgFloorSetting', 'AuditLog', 'User']
  await Promise.all(models.map(async (name) => (await require(`../models/${name}`).getTenantModel('mg')).deleteMany({})))
}, 60000)

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
}, 60000)

describe('MG Floor metal loss and batch time', () => {
  test('counts approved batches only: loss, times, today vs all-time averages, best and running batch', async () => {
    const op = await createOperator()
    const fm = await createFloorManager()

    await sendAndApprove(op, fm, { batchLabel: '1', direction: 'IN', lines: [gold(1000, '08:00'), { metal: 'Alloy', qty: 50, purity: null, time: '08:05' }] })
    await sendAndApprove(op, fm, { batchLabel: '1', direction: 'OUT', lines: [gold(1040, '12:00')] })
    await sendAndApprove(op, fm, { batchLabel: '2', direction: 'IN', lines: [gold(500, '13:00')] })
    await sendAndApprove(op, fm, { batchLabel: '2', direction: 'OUT', lines: [gold(498, '15:30')] })
    await sendAndApprove(op, fm, { batchLabel: '3', direction: 'IN', lines: [gold(300, '16:00')] })
    await sendAndApprove(op, fm, { batchLabel: '4', direction: 'IN', lines: [gold(200, '17:00')], approve: false })

    const Workbook = await require('../models/OperationsProductionEntry').getTenantModel('mg')
    await Workbook.create({
      departmentKey: 'melting',
      batchNumber: '9',
      date: '2026-09-20',
      metalIn: 1000,
      metalOut: 999,
      metalLoss: 1,
      batchStartedAt: new Date('2026-09-20T06:00:00Z'),
      batchOverAt: new Date('2026-09-20T07:40:00Z'),
    })
    await Workbook.create({ departmentKey: 'rolling', batchNumber: '1', date: DAY, metalIn: 100, metalOut: 50, metalLoss: 50 })

    const res = await stats(op)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ department: 'melting', date: DAY, lossLimitPct: null, canSetLossLimit: false })
    expect(res.body.loss).toEqual({
      last: { batchNumber: '2', date: DAY, loss: 2, lossPct: 0.4 },
      todayTotal: { loss: 12, lossPct: 0.77, batches: 2 },
      todayAvg: { loss: 6, lossPct: 0.77, batches: 2 },
      overallAvg: { loss: 4.333, lossPct: 0.51, batches: 3 },
      bestToday: { batchNumber: '2', date: DAY, loss: 2, lossPct: 0.4 },
      bestEver: { batchNumber: '9', date: '2026-09-20', loss: 1, lossPct: 0.1 },
    })
    expect(res.body.time).toMatchObject({
      running: { batchNumber: '3', date: DAY },
      last: { batchNumber: '2', date: DAY, minutes: 150 },
      todayAvg: { minutes: 195, batches: 2 },
      overallAvg: { minutes: 163, batches: 3 },
      bestToday: { batchNumber: '2', date: DAY, minutes: 150 },
      bestEver: { batchNumber: '9', date: '2026-09-20', minutes: 100 },
    })
    expect(new Date(res.body.time.running.startedAt).toISOString()).toBe('2026-09-28T12:00:00.000Z')
  })

  test('time averages: all-time finished batch minutes per department, forgotten Metal Outs left out', async () => {
    const op = await createOperator()
    const Workbook = await require('../models/OperationsProductionEntry').getTenantModel('mg')
    const row = (departmentKey, batchNumber, start, over) => Workbook.create({
      departmentKey,
      batchNumber,
      date: DAY,
      batchStartedAt: new Date(start),
      batchOverAt: over ? new Date(over) : null,
    })
    await row('melting', '1', '2026-09-28T04:00:00Z', '2026-09-28T05:40:00Z')
    await row('melting', '2', '2026-09-28T06:00:00Z', '2026-09-28T09:20:00Z')
    await row('melting', '3', '2026-09-28T10:00:00Z', null)
    await row('melting', '4', '2026-09-20T10:00:00Z', '2026-09-23T10:00:00Z')
    await row('rolling', '1', '2026-09-28T04:00:00Z', '2026-09-28T05:00:00Z')

    const res = await request(app).get('/api/mg-floor/batch-stats/time-averages').set(headers(op))
    expect(res.status).toBe(200)
    expect(res.body.averages).toEqual({ melting: 150, rolling: 60 })
  })

  test('empty department returns nulls; unknown department is 400', async () => {
    const op = await createOperator()
    const res = await stats(op)
    expect(res.status).toBe(200)
    expect(res.body.loss).toEqual({ last: null, todayTotal: null, todayAvg: null, overallAvg: null, bestToday: null, bestEver: null })
    expect(res.body.time).toEqual({ running: null, last: null, todayAvg: null, overallAvg: null, bestToday: null, bestEver: null })
    expect((await stats(op, { department: 'nowhere', date: DAY })).status).toBe(400)
  })

  test('only managers set the loss limit; it is per department, audited and can be removed', async () => {
    const op = await createOperator()
    const fm = await createFloorManager()

    expect((await setLimit(op, { department: 'melting', lossLimitPct: 0.5 })).status).toBe(403)
    expect((await setLimit(fm, { department: 'melting', lossLimitPct: 0 })).status).toBe(400)
    expect((await setLimit(fm, { department: 'melting', lossLimitPct: 150 })).status).toBe(400)

    const set = await setLimit(fm, { department: 'melting', lossLimitPct: 0.5 })
    expect(set.status).toBe(200)
    expect(set.body).toMatchObject({ department: 'melting', lossLimitPct: 0.5, lossLimitSetBy: fm.name })

    expect((await stats(op)).body).toMatchObject({ lossLimitPct: 0.5, lossLimitSetBy: fm.name })
    expect((await stats(fm)).body.canSetLossLimit).toBe(true)
    expect((await stats(op, { department: 'rolling', date: DAY })).body.lossLimitPct).toBeNull()

    await setLimit(fm, { department: 'rolling', lossLimitPct: 1.25 })
    const all = await request(app).get('/api/mg-floor/batch-stats/loss-limits').set(headers(op))
    expect(all.status).toBe(200)
    expect(all.body.limits).toEqual({ melting: 0.5, rolling: 1.25 })

    const AuditLog = await require('../models/AuditLog').getTenantModel('mg')
    const audit = await AuditLog.findOne({ action: 'mg_floor_loss_limit_set', 'changes.department': 'melting' }).lean()
    expect(audit.changes).toMatchObject({ department: 'melting', from: null, to: 0.5 })

    expect((await setLimit(fm, { department: 'melting', lossLimitPct: null })).body.lossLimitPct).toBeNull()
    expect((await stats(op)).body.lossLimitPct).toBeNull()
  })
})
