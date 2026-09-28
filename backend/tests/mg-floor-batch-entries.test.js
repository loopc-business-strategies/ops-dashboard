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
  const OperationsProductionEntry = require('../models/OperationsProductionEntry')
  await Promise.all([
    (await FloorBatchEntry.getTenantModel('mg')).deleteMany({}),
    (await OperationsProductionEntry.getTenantModel('mg')).deleteMany({}),
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

  describe('without the unique activeKey index (hardened deploys run with autoIndex off)', () => {
    let FloorBatchEntry
    beforeEach(async () => {
      FloorBatchEntry = await require('../models/FloorBatchEntry').getTenantModel('mg')
      await FloorBatchEntry.createIndexes()
      await FloorBatchEntry.collection.dropIndex('activeKey_1')
    })
    afterEach(async () => {
      await FloorBatchEntry.deleteMany({})
      await FloorBatchEntry.createIndexes()
    })

    test('a second live entry for the same batch is still 409', async () => {
      const op = await createOperator()
      expect((await submit(op, batchBody())).status).toBe(201)

      const dup = await submit(op, batchBody())
      expect(dup.status).toBe(409)
      expect(dup.body.code).toBe('BATCH_ENTRY_EXISTS')
      expect(await FloorBatchEntry.countDocuments({})).toBe(1)
    })

    test('a duplicate that slipped in cannot be approved once the batch is approved', async () => {
      const op = await createOperator()
      const fm = await createFloorManager()
      const first = await submit(op, batchBody())
      expect((await approve(fm, first.body.entry._id)).status).toBe(200)

      const { direction, department, batchLabel, entryDate, lines, employeeId, employeeName, activeKey } = first.body.entry
      const stray = await FloorBatchEntry.create({
        entryId: `be_stray_${Date.now().toString(36)}`,
        direction, department, batchLabel, entryDate, lines, employeeId, employeeName, activeKey,
        status: 'PENDING',
        submittedAt: new Date(),
      })
      const res = await approve(fm, stray._id)
      expect(res.status).toBe(409)
      expect(res.body.code).toBe('BATCH_ENTRY_EXISTS')
      expect((await FloorBatchEntry.findById(stray._id).lean()).status).toBe('PENDING')

      expect((await reject(fm, stray._id, { reason: 'duplicate entry' })).status).toBe(200)
    })
  })

  test('6. department spoofing: operators always submit under their assigned floor department', async () => {
    const op = await createOperator()

    const spoofed = await submit(op, batchBody({ department: 'rolling' }))
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
    const forRolling = await submit(fm, batchBody({ department: 'rolling' }))
    expect(forRolling.status).toBe(201)
    expect(forRolling.body.entry.department).toBe('rolling')
    const legacyKey = await submit(fm, batchBody({ department: 'packing' }))
    expect(legacyKey.status).toBe(201)
    expect(legacyKey.body.entry.department).toBe('finished_goods')
    for (const department of ['vault', 'casting', 'polishing']) {
      const unknown = await submit(fm, batchBody({ department }))
      expect(unknown.status).toBe(400)
      expect(unknown.body.code).toBe('INVALID_DEPARTMENT')
    }
  })

  test('6b. operators with a legacy floor department submit under the matching workbook department', async () => {
    const op = await createOperator({ floorDepartment: 'bangle_division' })
    const res = await submit(op, batchBody({ department: 'bangle_division' }))
    expect(res.status).toBe(201)
    expect(res.body.entry.department).toBe('bangle_area')

    const retired = await createOperator({ floorDepartment: 'casting' })
    const noDept = await submit(retired, batchBody({ batchLabel: '2' }))
    expect(noDept.status).toBe(403)
    expect(noDept.body.code).toBe('FLOOR_DEPARTMENT_REQUIRED')
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

    const spoofed = batchBody({ department: 'rolling' })
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

describe('MG Floor approvals fill the Operations → Production workbook', () => {
  const WORKBOOK = '/api/erp/production-control/operations-entries'
  const workbookRows = async (user) => {
    const res = await request(app).get(WORKBOOK).set(headers(user))
    expect(res.status).toBe(200)
    return res.body.entries
  }

  test('IN approval fills Metal IN, purity, fine gold and start; OUT approval completes the same row', async () => {
    const op = await createOperator()
    const fm = await createFloorManager()

    const sentIn = await submit(op, batchBody({ batchLabel: '7', tzOffsetMinutes: 240 }))
    expect(sentIn.body.entry.tzOffsetMinutes).toBe(240)
    expect(await workbookRows(fm)).toHaveLength(0)

    const approvedIn = await approve(fm, sentIn.body.entry._id)
    expect(approvedIn.body.workbookEntryId).toBeTruthy()
    let rows = await workbookRows(fm)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      source: 'mg_floor',
      departmentKey: 'melting',
      date: '2026-09-28',
      batchNumber: '7',
      metalIn: 1330.7,
      fineGold: 1243.949,
      purity: 93.48,
      metalOut: null,
      metalLoss: null,
      employeeName: op.name,
      departmentManagerName: fm.name,
      floorInEntryId: sentIn.body.entry.entryId,
    })
    expect(new Date(rows[0].batchStartedAt).toISOString()).toBe('2026-09-28T04:40:00.000Z')

    const sentOut = await submit(op, batchBody({
      batchLabel: '7',
      direction: 'OUT',
      tzOffsetMinutes: 240,
      lines: [{ metal: 'Gold', qty: 1320.5, purity: 995, time: '16:05' }],
    }))
    await approve(fm, sentOut.body.entry._id)
    rows = await workbookRows(fm)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ metalIn: 1330.7, metalOut: 1320.5, metalLoss: 10.2, purity: 93.48 })
    expect(new Date(rows[0].batchOverAt).toISOString()).toBe('2026-09-28T12:05:00.000Z')
    expect(rows[0].floorOutEntryId).toBe(sentOut.body.entry.entryId)
  })

  test('OUT approved first creates the row; rejected batches never reach the workbook', async () => {
    const op = await createOperator()
    const fm = await createFloorManager()

    const rejected = await submit(op, batchBody({ batchLabel: '8' }))
    await reject(fm, rejected.body.entry._id, { reason: 'Wrong gold weight' })
    expect(await workbookRows(fm)).toHaveLength(0)

    const out = await submit(op, batchBody({
      batchLabel: '9',
      direction: 'OUT',
      lines: [{ metal: 'Gold', qty: 500, purity: null, time: '09:00' }],
    }))
    await approve(fm, out.body.entry._id)
    const rows = await workbookRows(fm)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ batchNumber: '9', metalIn: null, metalOut: 500, employeeName: op.name })
    // No tablet offset: MG_FLOOR_TIMEZONE default (Asia/Dubai, UTC+4).
    expect(new Date(rows[0].batchOverAt).toISOString()).toBe('2026-09-28T05:00:00.000Z')
  })

  test('approving pushes a live update to open MG Production Dashboards; rejecting does not', async () => {
    const op = await createOperator()
    const fm = await createFloorManager()
    const { bus } = require('../utils/realtimeBus')
    const broadcasts = []
    const sseEvents = []
    const onSse = (event) => { if (event.type === 'production:update') sseEvents.push(event) }
    const previous = app.get('realtimeServer')
    app.set('realtimeServer', { broadcastProductionUpdate: (...args) => broadcasts.push(args) })
    bus.on('event', onSse)
    try {
      const rejected = await submit(op, batchBody({ batchLabel: '4' }))
      await reject(fm, rejected.body.entry._id, { reason: 'Wrong gold weight' })
      expect(broadcasts).toHaveLength(0)
      expect(sseEvents).toHaveLength(0)

      const sent = await submit(op, batchBody({ batchLabel: '5' }))
      const approved = await approve(fm, sent.body.entry._id)
      expect(broadcasts).toEqual([
        ['mg', 'workbook.mg_floor_batch', { entryId: approved.body.workbookEntryId }],
      ])
      expect(sseEvents).toEqual([expect.objectContaining({
        tenant: 'mg',
        data: { event: 'workbook.mg_floor_batch', entryId: approved.body.workbookEntryId },
      })])
    } finally {
      bus.off('event', onSse)
      app.set('realtimeServer', previous)
    }
  })

  test('MG Floor rows are locked: only rating, breakdown and requests can be edited; no delete', async () => {
    const op = await createOperator()
    const fm = await createFloorManager()
    const sent = await submit(op, batchBody())
    await approve(fm, sent.body.entry._id)
    const [row] = await workbookRows(fm)

    const locked = await request(app).patch(`${WORKBOOK}/${row._id}`).set(headers(fm)).send({ metalIn: 1 })
    expect(locked.status).toBe(409)
    expect(locked.body.code).toBe('MG_FLOOR_ROW_LOCKED')

    const rated = await request(app).patch(`${WORKBOOK}/${row._id}`).set(headers(fm)).send({ rating: 'A', requests: 'More flux' })
    expect(rated.status).toBe(200)
    expect(rated.body.entry).toMatchObject({ rating: 'A', requests: 'More flux', metalIn: row.metalIn, source: 'mg_floor' })

    const del = await request(app).delete(`${WORKBOOK}/${row._id}`).set(headers(fm))
    expect(del.status).toBe(409)
    expect(await workbookRows(fm)).toHaveLength(1)
  })

  test('sync-workbook links batches approved before the link and is safe to repeat', async () => {
    const op = await createOperator({ floorDepartment: 'packing' })
    const fm = await createFloorManager()
    const FloorBatchEntry = await require('../models/FloorBatchEntry').getTenantModel('mg')
    const now = new Date()
    const base = {
      batchLabel: '3',
      entryDate: '2026-09-27',
      lines: [{ metal: 'Gold', qty: 100, purity: 91.6, time: '10:00' }],
      employeeId: op._id,
      employeeName: op.name,
      status: 'APPROVED',
      submittedAt: now,
      decidedAt: now,
      decidedByName: fm.name,
    }
    await FloorBatchEntry.create([
      { ...base, entryId: 'be_legacy_in_0001', direction: 'IN', department: 'packing' },
      { ...base, entryId: 'be_legacy_out_0001', direction: 'OUT', department: 'packing', lines: [{ metal: 'Gold', qty: 99, purity: null, time: '15:00' }] },
      { ...base, entryId: 'be_legacy_cast_0001', direction: 'IN', department: 'casting' },
      { ...base, entryId: 'be_legacy_pend_0001', direction: 'IN', department: 'melting', status: 'PENDING', batchLabel: '4' },
    ])

    const SYNC = '/api/mg-floor/batch-entries/sync-workbook'
    expect((await request(app).post(SYNC).set(headers(op)).send({})).status).toBe(403)

    const first = await request(app).post(SYNC).set(headers(fm)).send({})
    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({ approved: 3, linked: 2, skipped: 1, skippedDepartments: { casting: 1 } })
    const again = await request(app).post(SYNC).set(headers(fm)).send({})
    expect(again.body.linked).toBe(2)

    const rows = await workbookRows(fm)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      departmentKey: 'finished_goods',
      batchNumber: '3',
      metalIn: 100,
      metalOut: 99,
      metalLoss: 1,
      purity: 91.6,
      fineGold: 91.6,
    })

    const listed = await request(app).get('/api/mg-floor/batch-entries').query({ department: 'finished_goods' }).set(headers(fm))
    expect(listed.body.entries).toHaveLength(2)
  })

  test('sync-workbook links batches approved before the link and is safe to repeat', async () => {
    const op = await createOperator({ floorDepartment: 'packing' })
    const fm = await createFloorManager()
    const FloorBatchEntry = await require('../models/FloorBatchEntry').getTenantModel('mg')
    const now = new Date()
    const base = {
      batchLabel: '3',
      entryDate: '2026-09-27',
      lines: [{ metal: 'Gold', qty: 100, purity: 91.6, time: '10:00' }],
      employeeId: op._id,
      employeeName: op.name,
      status: 'APPROVED',
      submittedAt: now,
      decidedAt: now,
      decidedByName: fm.name,
    }
    await FloorBatchEntry.create([
      { ...base, entryId: 'be_legacy_in_0001', direction: 'IN', department: 'packing' },
      { ...base, entryId: 'be_legacy_out_0001', direction: 'OUT', department: 'packing', lines: [{ metal: 'Gold', qty: 99, purity: null, time: '15:00' }] },
      { ...base, entryId: 'be_legacy_cast_0001', direction: 'IN', department: 'casting' },
      { ...base, entryId: 'be_legacy_pend_0001', direction: 'IN', department: 'melting', status: 'PENDING', batchLabel: '4' },
    ])

    const SYNC = '/api/mg-floor/batch-entries/sync-workbook'
    expect((await request(app).post(SYNC).set(headers(op)).send({})).status).toBe(403)

    const first = await request(app).post(SYNC).set(headers(fm)).send({})
    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({ approved: 3, linked: 2, skipped: 1, skippedDepartments: { casting: 1 } })
    const again = await request(app).post(SYNC).set(headers(fm)).send({})
    expect(again.body.linked).toBe(2)

    const rows = await workbookRows(fm)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      departmentKey: 'finished_goods',
      batchNumber: '3',
      metalIn: 100,
      metalOut: 99,
      metalLoss: 1,
      purity: 91.6,
      fineGold: 91.6,
    })

    const listed = await request(app).get('/api/mg-floor/batch-entries').query({ department: 'finished_goods' }).set(headers(fm))
    expect(listed.body.entries).toHaveLength(2)
  })

  test('offline sync keeps the tablet offset', async () => {
    const op = await createOperator()
    const body = batchBody({ tzOffsetMinutes: 330 })
    await sync(op, [{ operationId: `be_${body.entryId}`, operationType: 'batch_entry', payload: body }])
    const FloorBatchEntry = await require('../models/FloorBatchEntry').getTenantModel('mg')
    const stored = await FloorBatchEntry.findOne({ entryId: body.entryId }).lean()
    expect(stored.tzOffsetMinutes).toBe(330)
  })
})
