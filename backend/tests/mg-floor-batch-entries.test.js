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
const createOperator = (overrides = {}) => createUser('mg', { productionRole: 'operator', floorDepartment: 'melting', ...overrides })
const createFloorManager = (overrides = {}) => createUser('mg', { role: 'department_head', productionRole: 'floor_manager', ...overrides })

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
const approve = (user, id) => request(app).post(`/api/mg-floor/batch-entries/${id}/approve`).set(headers(user)).send({})
const reject = (user, id, body) => request(app).post(`/api/mg-floor/batch-entries/${id}/reject`).set(headers(user)).send(body)
const sync = (user, operations) => request(app).post('/api/mg-floor/sync').set(headers(user)).send({ operations })

async function auditFor(action, entryId) {
  const AuditLog = await require('../models/AuditLog').getTenantModel('mg')
  return AuditLog.findOne({ action, 'changes.entryId': entryId }).lean()
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
  const FloorBatchEntry = require('../models/FloorBatchEntry')
  const FloorSyncOperation = require('../models/FloorSyncOperation')
  const AuditLog = require('../models/AuditLog')
  await Promise.all([
    (await FloorBatchEntry.getTenantModel('mg')).deleteMany({}),
    (await FloorSyncOperation.getTenantModel('mg')).deleteMany({}),
    (await AuditLog.getTenantModel('mg')).deleteMany({}),
    (await User.getTenantModel('mg')).deleteMany({}),
    (await User.getTenantModel('cg')).deleteMany({}),
  ])
}, 60000)

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
}, 60000)

describe('MG Floor batch entries (manual entry + Floor Manager approval)', () => {
  test('1. manual submit: operator sends a batch; it is PENDING under their floor department and audited', async () => {
    const op = await createOperator()
    const body = batchBody()

    const res = await submit(op, body)
    expect(res.status).toBe(201)
    expect(res.body.entry).toMatchObject({
      status: 'PENDING',
      direction: 'IN',
      department: 'melting',
      batchLabel: '1',
      entryDate: '2026-09-28',
      employeeName: op.name,
    })
    expect(res.body.entry.lines[0]).toMatchObject({ metal: 'Gold', qty: 1250.2, purity: 99.5, time: '08:40' })

    const audit = await auditFor('mg_floor_batch_entry_submitted', body.entryId)
    expect(audit).toBeTruthy()
    expect(audit.changes).toMatchObject({
      entryId: body.entryId,
      batchLabel: '1',
      direction: 'IN',
      department: 'melting',
      employeeName: op.name,
      status: 'PENDING',
    })
    expect(String(audit.changes.employeeId)).toBe(String(op._id))
  })

  test('2. invalid qty is rejected', async () => {
    const op = await createOperator()
    for (const lines of [
      [{ metal: 'Gold', qty: null, purity: 99.5, time: '' }],
      [{ metal: 'Gold', qty: -5, purity: null, time: '' }],
      [{ metal: 'Gold', qty: 0, purity: null, time: '' }],
      [{ metal: 'Gold', qty: 'abc', purity: null, time: '' }],
      [{ metal: 'Gold', qty: 10, purity: null, time: '' }, { metal: 'Alloy', qty: -1, purity: null, time: '' }],
    ]) {
      const res = await submit(op, batchBody({ lines }))
      expect(res.status).toBe(400)
    }
  })

  test('3. invalid purity is rejected', async () => {
    const op = await createOperator()
    for (const purity of [1200, 0, -1, 'high']) {
      const res = await submit(op, batchBody({ lines: [{ metal: 'Gold', qty: 10, purity, time: '' }] }))
      expect(res.status).toBe(400)
    }
  })

  test('4. invalid direction is rejected', async () => {
    const op = await createOperator()
    for (const direction of ['SIDEWAYS', '', 'TRANSFER']) {
      const res = await submit(op, batchBody({ direction }))
      expect(res.status).toBe(400)
    }
  })

  test('5. duplicate: same entryId replays the stored entry; a second live entry for the batch is 409', async () => {
    const op = await createOperator()
    const body = batchBody()
    const first = await submit(op, body)
    expect(first.status).toBe(201)

    const replay = await submit(op, body)
    expect(replay.status).toBe(200)
    expect(replay.body.reused).toBe(true)
    expect(replay.body.entry._id).toBe(first.body.entry._id)

    const dup = await submit(op, batchBody())
    expect(dup.status).toBe(409)
    expect(dup.body.code).toBe('BATCH_ENTRY_EXISTS')

    expect((await submit(op, batchBody({ batchLabel: '2' }))).status).toBe(201)
    expect((await submit(op, batchBody({ direction: 'OUT' }))).status).toBe(201)
  })

  test('6. department spoofing: operators always submit under their assigned floor department', async () => {
    const op = await createOperator()

    const spoofed = await submit(op, batchBody({ department: 'casting' }))
    expect(spoofed.status).toBe(403)
    expect(spoofed.body.code).toBe('DEPARTMENT_MISMATCH')

    const implicit = await submit(op, batchBody({ department: undefined }))
    expect(implicit.status).toBe(201)
    expect(implicit.body.entry.department).toBe('melting')

    const sameCase = await submit(op, batchBody({ department: 'MELTING', batchLabel: '2' }))
    expect(sameCase.status).toBe(201)
    expect(sameCase.body.entry.department).toBe('melting')

    const unassigned = await createOperator({ floorDepartment: '' })
    const noDept = await submit(unassigned, batchBody())
    expect(noDept.status).toBe(403)
    expect(noDept.body.code).toBe('FLOOR_DEPARTMENT_REQUIRED')

    const fm = await createFloorManager()
    const forCasting = await submit(fm, batchBody({ department: 'casting' }))
    expect(forCasting.status).toBe(201)
    expect(forCasting.body.entry.department).toBe('casting')
    const unknown = await submit(fm, batchBody({ department: 'vault' }))
    expect(unknown.status).toBe(400)
    expect(unknown.body.code).toBe('INVALID_DEPARTMENT')
  })

  test('7. approve: floor manager approves; decision fields and audit are stored; nothing is posted', async () => {
    const op = await createOperator()
    const fm = await createFloorManager()
    const body = batchBody()
    const sent = await submit(op, body)

    const res = await approve(fm, sent.body.entry._id)
    expect(res.status).toBe(200)
    expect(res.body.entry).toMatchObject({ status: 'APPROVED', decidedByName: fm.name, rejectReason: '' })
    expect(String(res.body.entry.decidedById)).toBe(String(fm._id))
    expect(res.body.entry.decidedAt).toBeTruthy()

    const audit = await auditFor('mg_floor_batch_entry_approved', body.entryId)
    expect(audit.changes).toMatchObject({
      entryId: body.entryId,
      batchLabel: '1',
      direction: 'IN',
      department: 'melting',
      employeeName: op.name,
      decidedByName: fm.name,
      status: 'APPROVED',
    })
    expect(audit.changes.decidedAt).toBeTruthy()

    const MetalMovement = await require('../models/MetalMovement').getTenantModel('mg')
    const ProductionPass = await require('../models/ProductionPass').getTenantModel('mg')
    expect(await MetalMovement.countDocuments({})).toBe(0)
    expect(await ProductionPass.countDocuments({})).toBe(0)
  })

  test('8. reject: stores reason, decision fields and audit', async () => {
    const op = await createOperator()
    const fm = await createFloorManager()
    const body = batchBody()
    const sent = await submit(op, body)

    const res = await reject(fm, sent.body.entry._id, { reason: 'Gold qty looks wrong' })
    expect(res.status).toBe(200)
    expect(res.body.entry).toMatchObject({ status: 'REJECTED', rejectReason: 'Gold qty looks wrong', decidedByName: fm.name })
    expect(String(res.body.entry.decidedById)).toBe(String(fm._id))
    expect(res.body.entry.decidedAt).toBeTruthy()

    const audit = await auditFor('mg_floor_batch_entry_rejected', body.entryId)
    expect(audit.changes).toMatchObject({
      entryId: body.entryId,
      department: 'melting',
      decidedByName: fm.name,
      status: 'REJECTED',
      rejectReason: 'Gold qty looks wrong',
    })
  })

  test('9. reject reason of at least 3 characters is required', async () => {
    const op = await createOperator()
    const fm = await createFloorManager()
    const sent = await submit(op, batchBody())
    const id = sent.body.entry._id

    for (const body of [{}, { reason: '' }, { reason: 'ab' }, { reason: '   ' }]) {
      const res = await reject(fm, id, body)
      expect(res.status).toBe(400)
    }
    const list = await request(app).get('/api/mg-floor/batch-entries').query({ status: 'PENDING' }).set(headers(fm))
    expect(list.body.entries).toHaveLength(1)
  })

  test('10. self-approval and operator approval are blocked; production manager may decide', async () => {
    const op = await createOperator()
    const otherOp = await createOperator()
    const fm = await createFloorManager()
    const pm = await createUser('mg', { role: 'management', productionRole: 'production_manager' })

    const sent = await submit(op, batchBody())
    expect((await approve(otherOp, sent.body.entry._id)).status).toBe(403)
    expect((await reject(otherOp, sent.body.entry._id, { reason: 'not mine' })).status).toBe(403)

    const fmOwn = await submit(fm, batchBody({ batchLabel: '2' }))
    expect(fmOwn.status).toBe(201)
    expect((await approve(fm, fmOwn.body.entry._id)).status).toBe(403)
    expect((await reject(fm, fmOwn.body.entry._id, { reason: 'my own' })).status).toBe(403)

    const byPm = await approve(pm, fmOwn.body.entry._id)
    expect(byPm.status).toBe(200)
    expect(byPm.body.entry.decidedByName).toBe(pm.name)
  })

  test('11. approved batch is immutable: no re-approve, reject or resubmit', async () => {
    const op = await createOperator()
    const fm = await createFloorManager()
    const sent = await submit(op, batchBody())
    expect((await approve(fm, sent.body.entry._id)).status).toBe(200)

    const again = await approve(fm, sent.body.entry._id)
    expect(again.status).toBe(409)
    expect(again.body.code).toBe('BATCH_ENTRY_DECIDED')
    expect((await reject(fm, sent.body.entry._id, { reason: 'changed my mind' })).status).toBe(409)
    expect((await submit(op, batchBody())).status).toBe(409)
  })

  test('12. rejected batch can be resubmitted but not approved', async () => {
    const op = await createOperator()
    const fm = await createFloorManager()
    const sent = await submit(op, batchBody())
    expect((await reject(fm, sent.body.entry._id, { reason: 'Recheck purity' })).status).toBe(200)

    expect((await approve(fm, sent.body.entry._id)).status).toBe(409)

    const resent = await submit(op, batchBody({ lines: [{ metal: 'Gold', qty: 1200, purity: 99.9, time: '09:00' }] }))
    expect(resent.status).toBe(201)
    expect(resent.body.entry.status).toBe('PENDING')
    expect((await approve(fm, resent.body.entry._id)).status).toBe(200)
  })

  test('13. offline outbox: batch_entry sync is idempotent; legacy types answer FEATURE_REMOVED', async () => {
    const op = await createOperator()
    const body = batchBody({ batchLabel: '2', direction: 'OUT' })
    const operations = [{ operationId: `be_${body.entryId}`, operationType: 'batch_entry', payload: body }]

    const first = await sync(op, operations)
    expect(first.status).toBe(200)
    expect(first.body.results[0]).toMatchObject({ syncStatus: 'SYNCED' })
    expect(first.body.results[0].result).toMatchObject({ type: 'batch_entry', status: 'PENDING' })

    const replay = await sync(op, operations)
    expect(replay.body.results[0].syncStatus).toBe('SYNCED')

    const direct = await submit(op, body)
    expect(direct.status).toBe(200)
    expect(direct.body.reused).toBe(true)

    const list = await request(app).get('/api/mg-floor/batch-entries').set(headers(op))
    expect(list.body.entries).toHaveLength(1)
    expect(list.body.entries[0]).toMatchObject({ direction: 'OUT', batchLabel: '2', status: 'PENDING' })

    const spoofed = batchBody({ department: 'casting' })
    const legacy = await sync(op, [
      { operationId: `be_${spoofed.entryId}`, operationType: 'batch_entry', payload: spoofed },
      { operationId: 'legacy_metal_in_1', operationType: 'metal_in', payload: { passId: 'x', receivedWeight: 10 } },
      { operationId: 'legacy_capture_1', operationType: 'weight_capture', payload: { weight: 10 } },
      { operationId: 'legacy_xrf_1', operationType: 'xrf_test', payload: {} },
    ])
    expect(legacy.status).toBe(200)
    expect(legacy.body.results[0]).toMatchObject({ syncStatus: 'FAILED', code: 'DEPARTMENT_MISMATCH' })
    for (const r of legacy.body.results.slice(1)) {
      expect(r).toMatchObject({ syncStatus: 'FAILED', code: 'FEATURE_REMOVED' })
    }
  })

  test('14. tenant isolation: non-MG sessions cannot submit, list or decide', async () => {
    const op = await createOperator()
    const sent = await submit(op, batchBody())
    const cgUser = await createUser('cg', { role: 'super_admin', floorDepartment: 'melting' })

    expect((await request(app).post('/api/mg-floor/batch-entries').set(headers(cgUser, 'cg')).send(batchBody())).status).toBe(403)
    expect((await request(app).get('/api/mg-floor/batch-entries').set(headers(cgUser, 'cg'))).status).toBe(403)
    expect((await request(app).post(`/api/mg-floor/batch-entries/${sent.body.entry._id}/approve`).set(headers(cgUser, 'cg')).send({})).status).toBe(403)

    const mgToken = { ...headers(op), 'x-tenant': 'cg' }
    expect([401, 403]).toContain((await request(app).get('/api/mg-floor/batch-entries').set(mgToken)).status)
  })

  test('list filters by status and returns counts; canDecide reflects the user', async () => {
    const op = await createOperator()
    const fm = await createFloorManager()
    const a = await submit(op, batchBody({ batchLabel: '1' }))
    await submit(op, batchBody({ batchLabel: '2' }))
    await approve(fm, a.body.entry._id)

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
})
