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
const StockMovement = require('../models/StockMovement')
const ProductionBatch = require('../models/ProductionBatch')
const ProductionPass = require('../models/ProductionPass')
const MetalMovement = require('../models/MetalMovement')
const ProcessRun = require('../models/ProcessRun')
const QcInspection = require('../models/QcInspection')
const AuditLog = require('../models/AuditLog')
const WorkOrder = require('../models/WorkOrder')

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
    name: `prod-user-${now}`,
    email: `prod-${now}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: 'password123',
    role: 'super_admin',
    department: 'production',
    ...overrides,
  })
}

async function wipeProductionCollections() {
  if (!isMongooseConnected(mongoose)) return
  const ProductionMachine = require('../models/ProductionMachine')
  const ProductionAlert = require('../models/ProductionAlert')
  await Promise.all([
    ProductionBatch.deleteMany({}),
    ProductionPass.deleteMany({}),
    MetalMovement.deleteMany({}),
    ProcessRun.deleteMany({}),
    QcInspection.deleteMany({}),
    InventoryItem.deleteMany({}),
    StockMovement.deleteMany({}),
    AuditLog.deleteMany({}),
    WorkOrder.deleteMany({}),
    ProductionMachine.deleteMany({}),
    ProductionAlert.deleteMany({}),
    (await User.getTenantModel('loopc')).deleteMany({}),
  ])
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
  await wipeProductionCollections()
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

function auth(user) {
  return {
    Host: 'api.loopcstrategies.com',
    'x-tenant': 'loopc',
    Authorization: `Bearer ${tokenFor(user)}`,
  }
}

describe('Production Control Center API', () => {
  test('happy path: create → issue vault → pass → receive → process → QC → return', async () => {
    const user = await createUser({ productionRole: 'production_manager' })
    const headers = auth(user)

    const item = await InventoryItem.create({
      name: 'Gold 18K Bar',
      type: 'raw_material',
      quantity: 10000,
      unit: 'g',
      weight: 10000,
    })

    const createRes = await request(app)
      .post('/api/erp/production-control/batches')
      .set(headers)
      .send({
        metalType: 'Gold',
        purity: '18K',
        initialWeight: 4850.25,
        purpose: 'Bangle Production',
        inventoryItemId: String(item._id),
        idempotencyKey: 'test-batch-1',
      })

    expect(createRes.status).toBe(201)
    expect(createRes.body.batch.batchNumber).toMatch(/^MG-/)
    const batchId = createRes.body.batch._id

    // Idempotent create
    const createAgain = await request(app)
      .post('/api/erp/production-control/batches')
      .set(headers)
      .send({
        metalType: 'Gold',
        purity: '18K',
        initialWeight: 4850.25,
        idempotencyKey: 'test-batch-1',
      })
    expect(createAgain.status).toBe(200)
    expect(createAgain.body.reused).toBe(true)

    const issueRes = await request(app)
      .post(`/api/erp/production-control/batches/${batchId}/issue-from-vault`)
      .set(headers)
      .send({ inventoryItemId: String(item._id), weight: 4850.25 })
    expect(issueRes.status).toBe(200)
    expect(issueRes.body.batch.status).toBe('ISSUED')

    const refreshedItem = await InventoryItem.findById(item._id)
    expect(refreshedItem.quantity).toBeCloseTo(10000 - 4850.25, 3)
    const movements = await StockMovement.find({ itemId: item._id })
    expect(movements).toHaveLength(1)
    expect(movements[0].reason).toMatch(/^production_issue:/)

    const passRes = await request(app)
      .post('/api/erp/production-control/passes')
      .set(headers)
      .send({
        batchId,
        fromDepartment: 'vault',
        toDepartment: 'melting',
        weight: 4850.25,
        purpose: 'Bangle Production',
      })
    expect(passRes.status).toBe(201)
    const passId = passRes.body.pass._id

    await request(app).post(`/api/erp/production-control/passes/${passId}/approve`).set(headers).expect(200)
    await request(app).post(`/api/erp/production-control/passes/${passId}/issue`).set(headers).expect(200)

    const receiveKey = 'recv-once'
    const recv1 = await request(app)
      .post(`/api/erp/production-control/passes/${passId}/receive`)
      .set(headers)
      .send({ receivedWeight: 4850.25, receiveIdempotencyKey: receiveKey })
    expect(recv1.status).toBe(200)
    expect(recv1.body.batch.currentDepartment).toBe('melting')
    expect(recv1.body.batch.currentHolderName).toBe(user.name)

    const recv2 = await request(app)
      .post(`/api/erp/production-control/passes/${passId}/receive`)
      .set(headers)
      .send({ receivedWeight: 4850.25, receiveIdempotencyKey: receiveKey })
    expect(recv2.status).toBe(200)
    expect(recv2.body.reused).toBe(true)

    const metalMoves = await MetalMovement.find({ batchId })
    expect(metalMoves).toHaveLength(1)

    const start = await request(app)
      .post('/api/erp/production-control/processes/start')
      .set(headers)
      .send({ batchId, process: 'Melting', department: 'melting' })
    expect(start.status).toBe(201)
    const runId = start.body.processRun._id

    const complete = await request(app)
      .post(`/api/erp/production-control/processes/${runId}/complete`)
      .set(headers)
      .send({ outputWeight: 4840, scrap: 5, loss: 5.25, completeIdempotencyKey: 'complete-1' })
    expect(complete.status).toBe(200)
    expect(complete.body.processRun.status).toBe('COMPLETED')

    const qc = await request(app)
      .post('/api/erp/production-control/qc')
      .set(headers)
      .send({ batchId, result: 'PASS', remarks: 'OK' })
    expect(qc.status).toBe(201)

    const ret = await request(app)
      .post(`/api/erp/production-control/batches/${batchId}/return-to-vault`)
      .set(headers)
      .send({ inventoryItemId: String(item._id) })
    expect(ret.status).toBe(200)
    expect(ret.body.batch.status).toBe('RETURNED_TO_VAULT')

    const stockAfter = await InventoryItem.findById(item._id)
    expect(stockAfter.quantity).toBeGreaterThan(10000 - 4850.25)

    const floor = await request(app).get('/api/erp/production-control/live-floor').set(headers)
    expect(floor.status).toBe(200)
    expect(floor.body.kpis).toBeDefined()

    const audits = await AuditLog.find({ resource: { $in: ['ProductionBatch', 'ProductionPass', 'ProcessRun'] } })
    expect(audits.length).toBeGreaterThan(3)

    // Existing WorkOrder collection untouched by production ops
    expect(await WorkOrder.countDocuments()).toBe(0)
  })

  test('rejects unauthorized operator weight adjustment', async () => {
    const mgr = await createUser({ productionRole: 'production_manager', email: `mgr-${Date.now()}@ex.com` })
    const op = await createUser({
      role: 'department_user',
      department: 'production',
      productionRole: 'operator',
      email: `op-${Date.now()}@ex.com`,
    })

    const createRes = await request(app)
      .post('/api/erp/production-control/batches')
      .set(auth(mgr))
      .send({ metalType: 'Silver', initialWeight: 100 })
    const batchId = createRes.body.batch._id

    const denied = await request(app)
      .post(`/api/erp/production-control/batches/${batchId}/weight-adjustments`)
      .set(auth(op))
      .send({ adjustment: -1, reason: 'Process Loss' })
    expect(denied.status).toBe(403)

    const allowed = await request(app)
      .post(`/api/erp/production-control/batches/${batchId}/weight-adjustments`)
      .set(auth(mgr))
      .send({ adjustment: -1, reason: 'Process Loss', idempotencyKey: 'adj-1' })
    expect(allowed.status).toBe(201)
    expect(allowed.body.batch.currentWeight).toBe(99)

    // Original weight preserved on adjustment record
    expect(allowed.body.adjustment.originalValue).toBe(100)
    expect(allowed.body.adjustment.adjustment).toBe(-1)
  })

  test('rejects negative / excessive pass weights and double concurrent-style version conflict', async () => {
    const user = await createUser({ productionRole: 'floor_manager' })
    const headers = auth(user)
    const createRes = await request(app)
      .post('/api/erp/production-control/batches')
      .set(headers)
      .send({ metalType: 'Gold', purity: '22K', initialWeight: 50 })
    const batchId = createRes.body.batch._id
    const version = createRes.body.batch.version

    const bad = await request(app)
      .post('/api/erp/production-control/passes')
      .set(headers)
      .send({ batchId, fromDepartment: 'vault', toDepartment: 'melting', weight: -5 })
    expect(bad.status).toBe(400)

    const excessive = await request(app)
      .post('/api/erp/production-control/passes')
      .set(headers)
      .send({ batchId, fromDepartment: 'vault', toDepartment: 'melting', weight: 9999 })
    expect(excessive.status).toBe(400)

    // Hold with stale version → 409
    await request(app)
      .post(`/api/erp/production-control/batches/${batchId}/hold`)
      .set(headers)
      .send({ reason: 'test', expectedVersion: version })
      .expect(200)

    const stale = await request(app)
      .post(`/api/erp/production-control/batches/${batchId}/release`)
      .set(headers)
      .send({ expectedVersion: version })
    expect(stale.status).toBe(409)
  })

  test('does not destroy existing inventory when creating empty live floor', async () => {
    const user = await createUser()
    await InventoryItem.create({ name: 'Keep Me', quantity: 42, unit: 'g' })
    const before = await InventoryItem.countDocuments()

    const floor = await request(app)
      .get('/api/erp/production-control/live-floor')
      .set(auth(user))
    expect(floor.status).toBe(200)
    expect(floor.body.kpis.activeBatches).toBe(0)
    expect(floor.body.board).toBeDefined()
    expect(floor.body.kpis.qcFailed).toBeDefined()

    expect(await InventoryItem.countDocuments()).toBe(before)
    expect((await InventoryItem.findOne({ name: 'Keep Me' })).quantity).toBe(42)
  })

  test('blocks process start on FAULT/OFFLINE/MAINTENANCE machines and summarizes WO links', async () => {
    const user = await createUser({ productionRole: 'production_manager' })
    const headers = auth(user)
    const ProductionMachine = require('../models/ProductionMachine')

    const wo = await WorkOrder.create({
      woNumber: `WO-TEST-${Date.now()}`,
      quantity: 10,
      product: 'Bangle',
      status: 'in_progress',
    })

    const batchRes = await request(app)
      .post('/api/erp/production-control/batches')
      .set(headers)
      .send({
        metalType: 'Gold',
        purity: '18K',
        initialWeight: 100,
        workOrderId: String(wo._id),
        workOrderNumber: wo.woNumber,
      })
    expect(batchRes.status).toBe(201)
    const batchId = batchRes.body.batch._id

    const machine = await ProductionMachine.create({
      machineCode: `M-${Date.now()}`,
      name: 'Faulty Caster',
      status: 'FAULT',
      isActive: true,
    })

    const denied = await request(app)
      .post('/api/erp/production-control/processes/start')
      .set(headers)
      .send({
        batchId,
        process: 'Casting',
        department: 'casting',
        machineId: String(machine._id),
      })
    expect(denied.status).toBe(400)
    expect(denied.body.message).toMatch(/FAULT|machine/i)

    const summary = await request(app)
      .get('/api/erp/production-control/work-orders-summary')
      .set(headers)
    expect(summary.status).toBe(200)
    expect(summary.body.byWorkOrder.some((r) => String(r.workOrderId) === String(wo._id))).toBe(true)

    const list = await request(app)
      .get('/api/erp/production-control/batches')
      .query({ search: wo.woNumber, limit: 10 })
      .set(headers)
    expect(list.status).toBe(200)
    expect(list.body.total).toBeGreaterThanOrEqual(1)
  })
})
