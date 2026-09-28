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
const createUser = async (tenant, overrides = {}) => {
  const TenantUser = await User.getTenantModel(tenant)
  seq += 1
  const tag = `${Date.now().toString(36)}${seq}`
  return TenantUser.create({
    name: `${tenant}-user-${tag}`,
    email: `${tenant}-user-${tag}@example.com`,
    password: 'password123',
    role: 'department_user',
    department: 'production',
    productionRole: 'operator',
    ...overrides,
  })
}
const createOperator = () => createUser('mg', { productionRole: 'operator' })
const createFloorManager = () => createUser('mg', { role: 'department_head', productionRole: 'floor_manager' })

const headers = (user, tenant = 'mg') => ({
  Host: HOST,
  'x-tenant': tenant,
  Authorization: `Bearer ${tokenFor(user, tenant)}`,
})

let entrySeq = 0
function batchBody(overrides = {}) {
  entrySeq += 1
  return {
    entryId: `be_test_${Date.now().toString(36)}_${entrySeq}`,
    direction: 'IN',
    department: 'melting',
    batchLabel: '1',
    entryDate: '2026-09-28',
    deviceId: 'MG-FLOOR-TABLET-001',
    lines: [
      { metal: 'Gold', qty: 1250.2, purity: 99.5, time: '08:40' },
      { metal: 'Alloy', qty: 80.5, purity: null, time: '08:41' },
    ],
    ...overrides,
  }
}

const submit = (user, body) => request(app).post('/api/mg-floor/batch-entries').set(headers(user)).send(body)

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
  const FloorBatchEntry = require('../models/FloorBatchEntry')
  await Promise.all([
    (await FloorBatchEntry.getTenantModel('mg')).deleteMany({}),
    (await User.getTenantModel('mg')).deleteMany({}),
    (await User.getTenantModel('cg')).deleteMany({}),
  ])
}, 60000)

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
}, 60000)

describe('MG Floor batch entries (Floor Manager approval)', () => {
  test('operator sends a batch; it is PENDING and replaying the same entryId is idempotent', async () => {
    const op = await createOperator()
    const body = batchBody()

    const first = await submit(op, body)
    expect(first.status).toBe(201)
    expect(first.body.entry).toMatchObject({
      status: 'PENDING',
      direction: 'IN',
      department: 'melting',
      batchLabel: '1',
      entryDate: '2026-09-28',
      employeeName: op.name,
    })
    expect(first.body.entry.lines[0]).toMatchObject({ metal: 'Gold', qty: 1250.2, purity: 99.5, time: '08:40' })

    const replay = await submit(op, body)
    expect(replay.status).toBe(200)
    expect(replay.body.reused).toBe(true)
    expect(replay.body.entry._id).toBe(first.body.entry._id)
  })

  test('a batch cannot be sent twice while pending, but can be resent after a rejection', async () => {
    const op = await createOperator()
    const fm = await createFloorManager()

    const first = await submit(op, batchBody())
    expect(first.status).toBe(201)

    const dup = await submit(op, batchBody())
    expect(dup.status).toBe(409)
    expect(dup.body.code).toBe('BATCH_ENTRY_EXISTS')

    const otherBatch = await submit(op, batchBody({ batchLabel: '2' }))
    expect(otherBatch.status).toBe(201)
    const outSide = await submit(op, batchBody({ direction: 'OUT' }))
    expect(outSide.status).toBe(201)

    const rejected = await request(app)
      .post(`/api/mg-floor/batch-entries/${first.body.entry._id}/reject`)
      .set(headers(fm))
      .send({ reason: 'Gold qty looks wrong' })
    expect(rejected.status).toBe(200)
    expect(rejected.body.entry).toMatchObject({ status: 'REJECTED', rejectReason: 'Gold qty looks wrong', decidedByName: fm.name })

    const resent = await submit(op, batchBody())
    expect(resent.status).toBe(201)
  })

  test('floor manager approves; approved batch is locked and cannot be decided again', async () => {
    const op = await createOperator()
    const fm = await createFloorManager()
    const sent = await submit(op, batchBody())

    const approved = await request(app)
      .post(`/api/mg-floor/batch-entries/${sent.body.entry._id}/approve`)
      .set(headers(fm))
      .send({})
    expect(approved.status).toBe(200)
    expect(approved.body.entry).toMatchObject({ status: 'APPROVED', decidedByName: fm.name })
    expect(approved.body.entry.decidedAt).toBeTruthy()

    const again = await request(app)
      .post(`/api/mg-floor/batch-entries/${sent.body.entry._id}/reject`)
      .set(headers(fm))
      .send({ reason: 'changed my mind' })
    expect(again.status).toBe(409)

    const dup = await submit(op, batchBody())
    expect(dup.status).toBe(409)
  })

  test('operators cannot approve; nobody can approve their own batch; reject needs a reason', async () => {
    const op = await createOperator()
    const otherOp = await createOperator()
    const fm = await createFloorManager()
    const sent = await submit(op, batchBody())
    const id = sent.body.entry._id

    const byOperator = await request(app).post(`/api/mg-floor/batch-entries/${id}/approve`).set(headers(otherOp)).send({})
    expect(byOperator.status).toBe(403)

    const noReason = await request(app).post(`/api/mg-floor/batch-entries/${id}/reject`).set(headers(fm)).send({ reason: '' })
    expect(noReason.status).toBe(400)

    const fmOwn = await submit(fm, batchBody({ batchLabel: '2' }))
    expect(fmOwn.status).toBe(201)
    const selfApprove = await request(app)
      .post(`/api/mg-floor/batch-entries/${fmOwn.body.entry._id}/approve`)
      .set(headers(fm))
      .send({})
    expect(selfApprove.status).toBe(403)
  })

  test('rejects batches without a valid quantity or purity', async () => {
    const op = await createOperator()
    const noQty = await submit(op, batchBody({ lines: [{ metal: 'Gold', qty: null, purity: 99.5, time: '' }] }))
    expect(noQty.status).toBe(400)
    const negative = await submit(op, batchBody({ lines: [{ metal: 'Gold', qty: -5, purity: null, time: '' }] }))
    expect(negative.status).toBe(400)
    const badPurity = await submit(op, batchBody({ lines: [{ metal: 'Gold', qty: 10, purity: 1200, time: '' }] }))
    expect(badPurity.status).toBe(400)
  })

  test('list filters by status and returns counts; canDecide reflects the user', async () => {
    const op = await createOperator()
    const fm = await createFloorManager()
    const a = await submit(op, batchBody({ batchLabel: '1' }))
    await submit(op, batchBody({ batchLabel: '2' }))
    await request(app).post(`/api/mg-floor/batch-entries/${a.body.entry._id}/approve`).set(headers(fm)).send({})

    const pending = await request(app).get('/api/mg-floor/batch-entries').query({ status: 'PENDING' }).set(headers(fm))
    expect(pending.status).toBe(200)
    expect(pending.body.canDecide).toBe(true)
    expect(pending.body.entries).toHaveLength(1)
    expect(pending.body.entries[0].batchLabel).toBe('2')
    expect(pending.body.counts).toEqual({ PENDING: 1, APPROVED: 1, REJECTED: 0 })

    const today = await request(app)
      .get('/api/mg-floor/batch-entries')
      .query({ entryDate: '2026-09-28', department: 'melting' })
      .set(headers(op))
    expect(today.status).toBe(200)
    expect(today.body.canDecide).toBe(false)
    expect(today.body.entries).toHaveLength(2)
  })

  test('offline outbox: batch_entry sync creates the entry once', async () => {
    const op = await createOperator()
    const body = batchBody({ batchLabel: '2', direction: 'OUT' })
    const operations = [{ operationId: `be_${body.entryId}`, operationType: 'batch_entry', payload: body }]

    const first = await request(app).post('/api/mg-floor/sync').set(headers(op)).send({ operations })
    expect(first.status).toBe(200)
    expect(first.body.results[0]).toMatchObject({ syncStatus: 'SYNCED' })
    expect(first.body.results[0].result).toMatchObject({ type: 'batch_entry', status: 'PENDING' })

    const replay = await request(app).post('/api/mg-floor/sync').set(headers(op)).send({ operations })
    expect(replay.body.results[0].syncStatus).toBe('SYNCED')

    const list = await request(app).get('/api/mg-floor/batch-entries').set(headers(op))
    expect(list.body.entries).toHaveLength(1)
    expect(list.body.entries[0]).toMatchObject({ direction: 'OUT', batchLabel: '2', status: 'PENDING' })
  })

  test('non-MG tenants are blocked', async () => {
    const cgUser = await createUser('cg')
    const res = await request(app).post('/api/mg-floor/batch-entries').set(headers(cgUser, 'cg')).send(batchBody())
    expect(res.status).toBe(403)
  })
})
