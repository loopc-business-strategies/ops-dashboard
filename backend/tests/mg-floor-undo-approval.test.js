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
async function send(op, { batchLabel = '1', direction, qty }) {
  entrySeq += 1
  const res = await request(app).post('/api/mg-floor/batch-entries').set(headers(op)).send({
    entryId: `be_undo_${Date.now().toString(36)}_${entrySeq}`,
    direction,
    department: 'melting',
    batchLabel,
    entryDate: DAY,
    tzOffsetMinutes: 240,
    lines: [{ metal: 'Gold', qty, purity: 99.5, time: direction === 'IN' ? '08:00' : '10:00' }],
  })
  expect(res.status).toBe(201)
  return res.body.entry
}
async function sendAndApprove(op, fm, opts) {
  const entry = await send(op, opts)
  expect((await request(app).post(`/api/mg-floor/batch-entries/${entry._id}/approve`).set(headers(fm)).send({})).status).toBe(200)
  return entry
}
const undo = (user, entry, reason = 'Wrong weight approved') =>
  request(app).post(`/api/mg-floor/batch-entries/${entry._id}/undo-approval`).set(headers(user)).send({ reason })
const workbookRow = async () =>
  (await require('../models/OperationsProductionEntry').getTenantModel('mg')).findOne({ departmentKey: 'melting', batchNumber: '1' }).lean()

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

describe('MG Floor undo a wrong approval', () => {
  test('Metal Out first, then Metal In: back to the operator, out of the workbook, audited, resendable', async () => {
    const op = await createOperator()
    const fm = await createFloorManager()
    const metalIn = await sendAndApprove(op, fm, { direction: 'IN', qty: 1000 })
    const metalOut = await sendAndApprove(op, fm, { direction: 'OUT', qty: 990 })
    expect(await workbookRow()).toMatchObject({ metalIn: 1000, metalOut: 990, metalLoss: 10 })

    expect((await undo(op, metalOut)).status).toBe(403)
    const blocked = await undo(fm, metalIn)
    expect(blocked.status).toBe(409)
    expect(blocked.body.code).toBe('UNDO_METAL_OUT_FIRST')
    expect((await undo(fm, metalOut, 'x')).status).toBe(400)

    const outUndone = await undo(fm, metalOut, 'Out was 909 not 990')
    expect(outUndone.status).toBe(200)
    expect(outUndone.body.workbook).toBe('cleared')
    expect(outUndone.body.entry).toMatchObject({
      status: 'REJECTED',
      rejectReason: 'Approval undone: Out was 909 not 990',
      undoReason: 'Out was 909 not 990',
      approvedByName: fm.name,
      decidedByName: fm.name,
    })
    expect(outUndone.body.entry.activeKey).toBeUndefined()
    expect(await workbookRow()).toMatchObject({ metalIn: 1000, metalOut: null, metalLoss: null, batchOverAt: null, floorOutEntryId: '' })
    expect((await undo(fm, metalOut)).body.code).toBe('BATCH_ENTRY_NOT_APPROVED')

    const tabletView = await request(app).get('/api/mg-floor/batch-entries').query({ entryDate: DAY, department: 'melting' }).set(headers(op))
    expect(tabletView.body.entries.find((e) => e._id === metalOut._id)).toMatchObject({ status: 'REJECTED' })
    expect(tabletView.body.undoWindowHours).toBe(24)

    const inUndone = await undo(fm, metalIn)
    expect(inUndone.status).toBe(200)
    expect(inUndone.body.workbook).toBe('removed')
    expect(await workbookRow()).toBeNull()

    const AuditLog = await require('../models/AuditLog').getTenantModel('mg')
    const audits = await AuditLog.find({ action: 'mg_floor_batch_entry_approval_undone' }).lean()
    expect(audits.map((a) => a.changes.direction).sort()).toEqual(['IN', 'OUT'])
    expect(audits.find((a) => a.changes.direction === 'OUT').changes).toMatchObject({ reason: 'Out was 909 not 990', approvedByName: fm.name, workbook: 'cleared' })

    await sendAndApprove(op, fm, { direction: 'IN', qty: 1001 })
    expect(await workbookRow()).toMatchObject({ metalIn: 1001 })
  })

  test('only within 24 hours of approving', async () => {
    const op = await createOperator()
    const fm = await createFloorManager()
    const metalIn = await sendAndApprove(op, fm, { direction: 'IN', qty: 1000 })
    const Entry = await require('../models/FloorBatchEntry').getTenantModel('mg')
    await Entry.updateOne({ _id: metalIn._id }, { $set: { decidedAt: new Date(Date.now() - 25 * 3600000) } })

    const res = await undo(fm, metalIn)
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('UNDO_WINDOW_PASSED')
    expect(await workbookRow()).toMatchObject({ metalIn: 1000 })
  })

  test('a row with hand-typed notes is kept, only the undone side is cleared', async () => {
    const op = await createOperator()
    const fm = await createFloorManager()
    const metalIn = await sendAndApprove(op, fm, { direction: 'IN', qty: 1000 })
    const Workbook = await require('../models/OperationsProductionEntry').getTenantModel('mg')
    await Workbook.updateOne({ departmentKey: 'melting', batchNumber: '1' }, { $set: { rating: 'Good' } })

    const res = await undo(fm, metalIn)
    expect(res.status).toBe(200)
    expect(res.body.workbook).toBe('cleared')
    expect(await workbookRow()).toMatchObject({ rating: 'Good', metalIn: null, fineGold: null, batchStartedAt: null, floorInEntryId: '' })
  })
})
