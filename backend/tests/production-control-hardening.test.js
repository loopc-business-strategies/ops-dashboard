/**
 * Production Control Center — metal integrity / workflow hardening tests.
 * Additive coverage; does not remove existing production-control.test.js cases.
 */
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
const InventoryItem = require('../models/InventoryItem')
const ProductionBatch = require('../models/ProductionBatch')
const ProductionPass = require('../models/ProductionPass')
const ProductionAlert = require('../models/ProductionAlert')
const AuditLog = require('../models/AuditLog')
const MetalMovement = require('../models/MetalMovement')
const ProcessRun = require('../models/ProcessRun')
const QcInspection = require('../models/QcInspection')
const WeightAdjustment = require('../models/WeightAdjustment')
const { assertStatusTransition } = require('../services/productionControl/statusTransitions')
const { ProductionError } = require('../services/productionControl/errors')

let mongo
let app

const tokenFor = (user, tenant = 'loopc') => jwt.sign(
  { id: user._id.toString(), company: tenant },
  process.env.JWT_SECRET,
  { algorithm: 'HS256' },
)

const createUser = async (overrides = {}) => {
  const TenantUser = await User.getTenantModel('loopc')
  const now = Date.now().toString(36)
  return TenantUser.create({
    name: `harden-user-${now}`,
    email: `harden-${now}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: 'password123',
    role: 'super_admin',
    department: 'production',
    ...overrides,
  })
}

async function wipe() {
  if (!isMongooseConnected(mongoose)) return
  const ProductionMachine = require('../models/ProductionMachine')
  const ProductionStockLot = require('../models/ProductionStockLot')
  await Promise.all([
    ProductionBatch.deleteMany({}),
    ProductionPass.deleteMany({}),
    MetalMovement.deleteMany({}),
    ProcessRun.deleteMany({}),
    QcInspection.deleteMany({}),
    InventoryItem.deleteMany({}),
    AuditLog.deleteMany({}),
    ProductionAlert.deleteMany({}),
    WeightAdjustment.deleteMany({}),
    ProductionMachine.deleteMany({}),
    ProductionStockLot.deleteMany({}),
    (await User.getTenantModel('loopc')).deleteMany({}),
  ])
}

function auth(user) {
  return {
    Host: 'api.loopcstrategies.com',
    'x-tenant': 'loopc',
    Authorization: `Bearer ${tokenFor(user)}`,
  }
}

async function issuedBatch(headers, weight = 1000) {
  const item = await InventoryItem.create({
    name: `Bar-${Date.now()}`,
    type: 'raw_material',
    quantity: weight * 5,
    unit: 'g',
    weight: weight * 5,
  })
  const createRes = await request(app)
    .post('/api/erp/production-control/batches')
    .set(headers)
    .send({
      metalType: 'Gold',
      purity: '18K',
      initialWeight: weight,
      inventoryItemId: String(item._id),
    })
  expect(createRes.status).toBe(201)
  const batchId = createRes.body.batch._id
  const issue = await request(app)
    .post(`/api/erp/production-control/batches/${batchId}/issue-from-vault`)
    .set(headers)
    .send({ inventoryItemId: String(item._id), weight })
  expect(issue.status).toBe(200)
  return { batchId, item, batch: await ProductionBatch.findById(batchId) }
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.RATE_LIMIT_MAX = '100000'
  process.env.AUTH_RATE_LIMIT_MAX = '100000'
  process.env.DEFAULT_TENANT = 'loopc'

  mongo = await startMongoMemoryServer()
  const mongoUri = mongo.getUri()
  process.env.MONGO_URI = mongoUri
  process.env.MONGO_URI_LOOPC = mongoUri

  await mongoose.connect(mongoUri)
  app = createApp()
})

afterEach(async () => {
  await wipe()
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('PCC hardening — metal integrity', () => {
  test('overlapping open pass weights are rejected', async () => {
    const user = await createUser({ productionRole: 'production_manager' })
    const headers = auth(user)
    const { batchId } = await issuedBatch(headers, 1000)

    const a = await request(app).post('/api/erp/production-control/passes').set(headers).send({
      batchId, fromDepartment: 'vault', toDepartment: 'melting', weight: 600,
    })
    expect(a.status).toBe(201)

    const b = await request(app).post('/api/erp/production-control/passes').set(headers).send({
      batchId, fromDepartment: 'vault', toDepartment: 'casting', weight: 500,
    })
    expect(b.status).toBe(400)
    expect(b.body.message).toMatch(/available transferable weight/i)
  })

  test('invalid fromDepartment is rejected and audited', async () => {
    const user = await createUser({ productionRole: 'floor_manager' })
    const headers = auth(user)
    const { batchId } = await issuedBatch(headers, 200)

    const bad = await request(app).post('/api/erp/production-control/passes').set(headers).send({
      batchId, fromDepartment: 'rolling', toDepartment: 'melting', weight: 50,
    })
    expect(bad.status).toBe(400)
    expect(bad.body.message).toMatch(/current department/i)

    const audits = await AuditLog.find({ action: 'PASS_REJECTED' })
    expect(audits.length).toBeGreaterThanOrEqual(1)
  })

  test('receive variance over tolerance requires reason and can HOLD', async () => {
    const user = await createUser({ productionRole: 'production_manager' })
    const headers = auth(user)
    const { batchId } = await issuedBatch(headers, 100)

    const passRes = await request(app).post('/api/erp/production-control/passes').set(headers).send({
      batchId, fromDepartment: 'vault', toDepartment: 'melting', weight: 100,
    })
    const passId = passRes.body.pass._id
    await request(app).post(`/api/erp/production-control/passes/${passId}/approve`).set(headers)
    await request(app).post(`/api/erp/production-control/passes/${passId}/issue`).set(headers)

    const missingReason = await request(app)
      .post(`/api/erp/production-control/passes/${passId}/receive`)
      .set(headers)
      .send({ receivedWeight: 80 })
    expect(missingReason.status).toBe(400)
    expect(missingReason.body.message).toMatch(/variance reason/i)

    const ok = await request(app)
      .post(`/api/erp/production-control/passes/${passId}/receive`)
      .set(headers)
      .send({ receivedWeight: 80, varianceReason: 'Scale discrepancy noted' })
    expect(ok.status).toBe(200)
    expect(ok.body.pass.weight).toBe(100) // issued weight preserved
    expect(ok.body.pass.receivedWeight).toBe(80)
    expect(ok.body.pass.variancePct).toBeGreaterThan(0.5)
    expect(ok.body.batch.status).toBe('HOLD')
  })

  test('impossible process weights are rejected', async () => {
    const user = await createUser({ productionRole: 'production_manager' })
    const headers = auth(user)
    const { batchId } = await issuedBatch(headers, 100)

    const passRes = await request(app).post('/api/erp/production-control/passes').set(headers).send({
      batchId, fromDepartment: 'vault', toDepartment: 'melting', weight: 100,
    })
    const passId = passRes.body.pass._id
    await request(app).post(`/api/erp/production-control/passes/${passId}/approve`).set(headers)
    await request(app).post(`/api/erp/production-control/passes/${passId}/issue`).set(headers)
    await request(app).post(`/api/erp/production-control/passes/${passId}/receive`).set(headers)
      .send({ receivedWeight: 100, receiveIdempotencyKey: `recv-${passId}` })

    const start = await request(app).post('/api/erp/production-control/processes/start').set(headers)
      .send({ batchId, process: 'Melting', department: 'melting', inputWeight: 100 })
    expect(start.status).toBe(201)
    const runId = start.body.processRun._id

    const bad = await request(app)
      .post(`/api/erp/production-control/processes/${runId}/complete`)
      .set(headers)
      .send({ outputWeight: 150, scrap: 0, loss: 0 })
    expect(bad.status).toBe(400)
    expect(bad.body.message).toMatch(/cannot exceed input/i)
  })

  test('SOP not followed requires reason', async () => {
    const user = await createUser({ productionRole: 'operator', role: 'department_user' })
    const mgr = await createUser({ productionRole: 'production_manager', email: `mgr-${Date.now()}@ex.com` })
    const headers = auth(mgr)
    const { batchId } = await issuedBatch(headers, 50)

    const passRes = await request(app).post('/api/erp/production-control/passes').set(headers).send({
      batchId, fromDepartment: 'vault', toDepartment: 'melting', weight: 50,
    })
    const passId = passRes.body.pass._id
    await request(app).post(`/api/erp/production-control/passes/${passId}/approve`).set(headers)
    await request(app).post(`/api/erp/production-control/passes/${passId}/issue`).set(headers)
    await request(app).post(`/api/erp/production-control/passes/${passId}/receive`).set(headers)
      .send({ receivedWeight: 50, receiveIdempotencyKey: `r-${passId}` })

    const start = await request(app).post('/api/erp/production-control/processes/start').set(auth(user))
      .send({ batchId, process: 'Melting', department: 'melting' })
    const runId = start.body.processRun._id

    const bad = await request(app)
      .post(`/api/erp/production-control/processes/${runId}/complete`)
      .set(auth(user))
      .send({ outputWeight: 49, scrap: 1, loss: 0, sopFollowed: false })
    expect(bad.status).toBe(400)
    expect(bad.body.message).toMatch(/SOP reason/i)
  })

  test('QC FAIL without reason rejected; REWORK links prior inspection', async () => {
    const user = await createUser({ productionRole: 'production_manager' })
    const headers = auth(user)
    const stock = await request(app).post('/api/erp/production-control/stock').set(headers)
      .send({ product: 'LinkLot', netWeight: 40, metalType: 'Gold', quantity: 4 })
    const lotId = stock.body.lot._id
    await request(app).post(`/api/erp/production-control/stock/${lotId}/available`).set(headers).send({})
    const alloc = await request(app).post('/api/erp/production-control/stock/select').set(headers)
      .send({ stockLotId: lotId, weight: 40, markIssued: true })
    const batchId = alloc.body.batch._id

    const noReason = await request(app).post('/api/erp/production-control/qc').set(headers)
      .send({ batchId, result: 'FAIL' })
    expect(noReason.status).toBe(400)

    const fail = await request(app).post('/api/erp/production-control/qc').set(headers)
      .send({ batchId, result: 'FAIL', failureReason: 'Surface defect' })
    expect(fail.status).toBe(201)
    const priorId = fail.body.inspection._id

    // release/path to rework — QC_FAILED can go to REWORK
    const rework = await request(app).post('/api/erp/production-control/qc').set(headers)
      .send({
        batchId,
        result: 'REWORK',
        reworkReason: 'Polish again',
        reworkOf: priorId,
      })
    expect(rework.status).toBe(201)
    expect(String(rework.body.inspection.reworkOf)).toBe(String(priorId))
    expect(rework.body.batch.status).toBe('REWORK')
  })

  test('invalid batch status transition helper rejects COMPLETED → ISSUED', () => {
    expect(() => assertStatusTransition('batch', 'COMPLETED', 'ISSUED')).toThrow(ProductionError)
    expect(() => assertStatusTransition('batch', 'AWAITING_ISSUE', 'ISSUED')).not.toThrow()
  })

  test('demo header blocks mutations', async () => {
    const user = await createUser({ productionRole: 'production_manager' })
    const headers = { ...auth(user), 'x-pcc-demo': '1' }
    const res = await request(app)
      .post('/api/erp/production-control/batches')
      .set(headers)
      .send({ metalType: 'Gold', purity: '18K', initialWeight: 10 })
    expect(res.status).toBe(403)
    expect(res.body.demo).toBe(true)
  })

  test('alert acknowledge then resolve lifecycle', async () => {
    const user = await createUser({ productionRole: 'floor_manager' })
    const headers = auth(user)
    const raised = await request(app).post('/api/erp/production-control/alerts').set(headers)
      .send({ title: 'Test alert', category: 'process', severity: 'warning', message: 'demo' })
    expect(raised.status).toBe(201)
    const id = raised.body.alert._id

    const ack = await request(app).post(`/api/erp/production-control/alerts/${id}/acknowledge`).set(headers)
    expect(ack.status).toBe(200)
    expect(ack.body.alert.status).toBe('ACKNOWLEDGED')

    const resolved = await request(app).post(`/api/erp/production-control/alerts/${id}/resolve`).set(headers)
    expect(resolved.status).toBe(200)
    expect(resolved.body.alert.status).toBe('RESOLVED')
  })

  test('my-tasks endpoint returns structure', async () => {
    const user = await createUser({ productionRole: 'operator', role: 'department_user' })
    const res = await request(app).get('/api/erp/production-control/my-tasks').set(auth(user))
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.tasks)).toBe(true)
    expect(res.body.counts).toBeDefined()
  })

  test('weight adjust accepts expectedVersion alias', async () => {
    const user = await createUser({ productionRole: 'production_manager' })
    const headers = auth(user)
    const createRes = await request(app).post('/api/erp/production-control/batches').set(headers)
      .send({ metalType: 'Silver', initialWeight: 20 })
    const batchId = createRes.body.batch._id
    const version = createRes.body.batch.version

    const ok = await request(app)
      .post(`/api/erp/production-control/batches/${batchId}/weight-adjustments`)
      .set(headers)
      .send({ adjustment: -1, reason: 'Calibration', expectedVersion: version })
    expect(ok.status).toBe(201)
    expect(ok.body.batch.currentWeight).toBe(19)
  })

  test('metal-custody totals shape', async () => {
    const user = await createUser({ productionRole: 'production_manager' })
    const headers = auth(user)
    await issuedBatch(headers, 100)

    const res = await request(app).get('/api/erp/production-control/metal-custody').set(headers)
    expect(res.status).toBe(200)
    expect(res.body.totals).toBeDefined()
    for (const key of ['vault', 'wip', 'transit', 'qc', 'hold', 'finished', 'rework']) {
      expect(res.body.totals[key]).toEqual(expect.objectContaining({
        count: expect.any(Number),
        weight: expect.any(Number),
      }))
    }
    expect(Array.isArray(res.body.batches)).toBe(true)
    expect(typeof res.body.total).toBe('number')
  })

  test('delays include threshold hours', async () => {
    const user = await createUser({ productionRole: 'floor_manager' })
    const headers = auth(user)
    const { batchId } = await issuedBatch(headers, 50)

    // Force batch past delay threshold
    await ProductionBatch.updateOne(
      { _id: batchId },
      { $set: { updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
      { timestamps: false },
    )

    const res = await request(app).get('/api/erp/production-control/delays').set(headers)
    expect(res.status).toBe(200)
    expect(res.body.thresholds).toEqual(expect.objectContaining({
      batchDelayedHours: expect.any(Number),
      processOverdueHours: expect.any(Number),
    }))
    expect(Array.isArray(res.body.delays)).toBe(true)
    const batchDelay = res.body.delays.find((d) => String(d.batchId) === String(batchId) && d.type === 'batch')
    expect(batchDelay).toBeDefined()
    expect(batchDelay.thresholdHours).toBe(res.body.thresholds.batchDelayedHours)
    expect(batchDelay.elapsedHours).toBeGreaterThanOrEqual(res.body.thresholds.batchDelayedHours)
  })

  test('rework-queue lineage', async () => {
    const user = await createUser({ productionRole: 'production_manager' })
    const headers = auth(user)
    const stock = await request(app).post('/api/erp/production-control/stock').set(headers)
      .send({ product: 'ReworkLot', netWeight: 30, metalType: 'Gold', quantity: 3 })
    const lotId = stock.body.lot._id
    await request(app).post(`/api/erp/production-control/stock/${lotId}/available`).set(headers).send({})
    const alloc = await request(app).post('/api/erp/production-control/stock/select').set(headers)
      .send({ stockLotId: lotId, weight: 30, markIssued: true })
    const batchId = alloc.body.batch._id

    const fail = await request(app).post('/api/erp/production-control/qc').set(headers)
      .send({ batchId, result: 'FAIL', failureReason: 'Scratch' })
    expect(fail.status).toBe(201)
    const priorId = fail.body.inspection._id

    const rework = await request(app).post('/api/erp/production-control/qc').set(headers)
      .send({ batchId, result: 'REWORK', reworkReason: 'Buff again', reworkOf: priorId })
    expect(rework.status).toBe(201)

    const queue = await request(app).get('/api/erp/production-control/rework-queue').set(headers)
    expect(queue.status).toBe(200)
    expect(Array.isArray(queue.body.items)).toBe(true)
    const item = queue.body.items.find((i) => String(i.batchId) === String(batchId))
    expect(item).toBeDefined()
    expect(item.latestQc).toBeTruthy()
    expect(String(item.latestQc.reworkOf || item.latestQc.previousInspectionId)).toBe(String(priorId))
    expect(item.originalQc).toBeTruthy()
    expect(String(item.originalQc._id)).toBe(String(priorId))
  })

  test('demo guard still blocks mutations', async () => {
    const user = await createUser({ productionRole: 'production_manager' })
    const headers = { ...auth(user), 'X-PCC-Demo': '1' }
    const res = await request(app)
      .patch('/api/erp/production-control/machines/000000000000000000000001')
      .set(headers)
      .send({ notes: 'should block' })
    expect(res.status).toBe(403)
    expect(res.body.demo).toBe(true)
  })
})
