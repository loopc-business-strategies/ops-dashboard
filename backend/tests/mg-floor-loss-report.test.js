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

const report = (user, query) => request(app).get('/api/mg-floor/loss-report').query(query).set(headers(user))

async function seed() {
  const Workbook = await require('../models/OperationsProductionEntry').getTenantModel('mg')
  await Workbook.create([
    { departmentKey: 'melting', date: '2026-09-01', batchNumber: '1', metalIn: 1000, metalOut: 990, metalLoss: 10, fineGold: 995, fineGoldOut: 985.05 },
    { departmentKey: 'melting', date: '2026-09-01', batchNumber: '2', metalIn: 500, metalOut: 499, metalLoss: 1 },
    { departmentKey: 'melting', date: '2026-09-01', batchNumber: '3', metalIn: 700, metalOut: null },
    { departmentKey: 'rolling', date: '2026-09-02', batchNumber: '1', metalIn: 200, metalOut: 199, metalLoss: 1 },
    { departmentKey: 'melting', date: '2026-10-05', batchNumber: '1', metalIn: 300, metalOut: 297, metalLoss: 3 },
  ])
  const Alert = await require('../models/ProductionAlert').getTenantModel('mg')
  const breakdown = (n, department, createdAt, resolvedAt) => ({
    alertNumber: `BD-TEST-${n}`,
    category: 'machine',
    code: 'MACHINE_BREAKDOWN',
    title: 'Breakdown',
    severity: 'critical',
    metadata: { department, trackFix: true },
    status: resolvedAt ? 'RESOLVED' : 'ACKNOWLEDGED',
    resolvedAt: resolvedAt ? new Date(resolvedAt) : null,
    createdAt: new Date(createdAt),
  })
  await Alert.collection.insertMany([
    breakdown(1, 'melting', '2026-08-31T21:00:00Z', '2026-08-31T22:30:00Z'),
    breakdown(2, 'melting', '2026-09-01T10:00:00Z', null),
    breakdown(3, 'melting', '2026-08-31T19:00:00Z', '2026-08-31T19:30:00Z'),
  ])
}

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
  const models = ['OperationsProductionEntry', 'FloorBatchEntry', 'ProductionAlert', 'MgFloorSetting', 'AuditLog', 'User']
  await Promise.all(models.map(async (name) => (await require(`../models/${name}`).getTenantModel('mg')).deleteMany({})))
}, 60000)

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
}, 60000)

describe('MG Floor loss report', () => {
  test('per department per day: loss, over-limit, fine gold, breakdown downtime', async () => {
    const fm = await createUser({ role: 'department_head', productionRole: 'floor_manager' })
    const op = await createUser({ floorDepartment: 'melting' })
    await seed()
    await request(app).put('/api/mg-floor/batch-stats/loss-limit').set(headers(fm)).send({ department: 'melting', lossLimitPct: 0.5 })

    expect((await report(op, { from: '2026-09-01', to: '2026-09-30' })).status).toBe(403)

    const res = await report(fm, { from: '2026-09-01', to: '2026-09-30' })
    expect(res.status).toBe(200)
    expect(res.body.limits).toMatchObject({ melting: 0.5, rolling: null })
    expect(res.body.rows.map((r) => `${r.period} ${r.department}`)).toEqual(['2026-09-01 melting', '2026-09-02 rolling'])
    expect(res.body.rows[0]).toMatchObject({
      batches: 2,
      metalIn: 1500,
      metalOut: 1489,
      loss: 11,
      lossPct: 0.73,
      overLimit: true,
      overLimitBatches: 1,
      fineBatches: 1,
      fineIn: 995,
      fineOut: 985.05,
      fineLoss: 9.95,
      breakdowns: 2,
      breakdownsNotFixed: 1,
      downtimeMinutes: 90,
    })
    expect(res.body.rows[1]).toMatchObject({ batches: 1, loss: 1, lossPct: 0.5, overLimit: false, fineIn: null, breakdowns: 0 })
    expect(res.body.total).toMatchObject({ batches: 3, loss: 12, metalIn: 1700, breakdowns: 2, downtimeMinutes: 90 })
    expect(res.body.byDepartment.map((d) => d.department)).toEqual(['melting', 'rolling'])
  })

  test('by month, one department, and range checks', async () => {
    const fm = await createUser({ role: 'department_head', productionRole: 'floor_manager' })
    await seed()

    const res = await report(fm, { from: '2026-08-01', to: '2026-10-31', groupBy: 'month', department: 'melting' })
    expect(res.status).toBe(200)
    expect(res.body.rows.map((r) => [r.period, r.batches, r.breakdowns])).toEqual([
      ['2026-08', 0, 1],
      ['2026-09', 2, 2],
      ['2026-10', 1, 0],
    ])
    expect(Object.keys(res.body.limits)).toEqual(['melting'])

    expect((await report(fm, { from: '2026-09-02', to: '2026-09-01' })).status).toBe(400)
    expect((await report(fm, { from: '2026-01-01', to: '2026-06-30' })).status).toBe(400)
    expect((await report(fm, { from: '2026-01-01', to: '2026-06-30', groupBy: 'month' })).status).toBe(200)
    expect((await report(fm, { from: '2026-09-01', to: '2026-09-30', department: 'nowhere' })).status).toBe(400)
  })

  test('by operator: loss counts against whoever sent Metal Out, most loss first', async () => {
    const fm = await createUser({ role: 'department_head', productionRole: 'floor_manager' })
    await request(app).put('/api/mg-floor/batch-stats/loss-limit').set(headers(fm)).send({ department: 'melting', lossLimitPct: 0.5 })
    const Workbook = await require('../models/OperationsProductionEntry').getTenantModel('mg')
    await Workbook.create([
      { departmentKey: 'melting', date: '2026-09-01', batchNumber: '1', metalIn: 1000, metalOut: 990, metalLoss: 10, employeeName: 'Ali', floorOutEntryId: 'out-1' },
      { departmentKey: 'melting', date: '2026-09-01', batchNumber: '2', metalIn: 500, metalOut: 499, metalLoss: 1, employeeName: 'Ali', floorOutEntryId: 'out-2' },
      { departmentKey: 'rolling', date: '2026-09-01', batchNumber: '1', metalIn: 200, metalOut: 199, metalLoss: 1, employeeName: 'Ali', floorOutEntryId: 'out-3' },
      { departmentKey: 'melting', date: '2026-09-02', batchNumber: '3', metalIn: 100, metalOut: 98, metalLoss: 2, employeeName: 'Manual Mo' },
      { departmentKey: 'melting', date: '2026-09-02', batchNumber: '4', metalIn: 50, metalOut: 50, metalLoss: 0 },
      { departmentKey: 'melting', date: '2026-09-02', batchNumber: '5', metalIn: 80, metalOut: null, employeeName: 'Ali' },
    ])
    const Entries = await require('../models/FloorBatchEntry').getTenantModel('mg')
    await Entries.collection.insertMany(['Sara', 'Ali', 'Sara'].map((name, i) => ({ entryId: `out-${i + 1}`, direction: 'OUT', employeeName: name })))

    const res = await report(fm, { from: '2026-09-01', to: '2026-09-30', view: 'operator' })
    expect(res.status).toBe(200)
    expect(res.body.view).toBe('operator')
    expect(res.body.byOperator.map((o) => [o.operator, o.batches, o.loss, o.overLimitBatches])).toEqual([
      ['Sara', 2, 11, 1],
      ['Manual Mo', 1, 2, 1],
      ['Ali', 1, 1, 0],
      ['', 1, 0, 0],
    ])
    expect(res.body.byOperator[0]).toMatchObject({ departments: ['melting', 'rolling'], metalIn: 1200, overLimit: false })
    expect(res.body.rows.map((r) => `${r.period} ${r.operator || '-'} ${r.department}`)).toEqual([
      '2026-09-01 Ali melting',
      '2026-09-01 Sara melting',
      '2026-09-01 Sara rolling',
      '2026-09-02 Manual Mo melting',
      '2026-09-02 - melting',
    ])
    expect(res.body.rows[1]).toMatchObject({ lossPct: 1, overLimit: true })
    expect(res.body.total).toMatchObject({ batches: 5, loss: 14, breakdowns: 0 })
    expect(res.body.byDepartment).toBeUndefined()

    expect((await report(fm, { from: '2026-09-01', to: '2026-09-30', view: 'shift' })).status).toBe(400)
  })
})
