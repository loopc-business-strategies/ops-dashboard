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
  const ProductionStockLot = require('../models/ProductionStockLot')
  const ProductionStockStatusEvent = require('../models/ProductionStockStatusEvent')
  const ProductionShiftConfig = require('../models/ProductionShiftConfig')
  const ProductionFloorSession = require('../models/ProductionFloorSession')
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
    ProductionStockLot.deleteMany({}),
    ProductionStockStatusEvent.deleteMany({}),
    ProductionShiftConfig.deleteMany({}),
    ProductionFloorSession.deleteMany({}),
    require('../models/ProductionMaintenanceWorkOrder').deleteMany({}),
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
    // activeBatches is WIP-only; completed/returned-today still appear on board.COMPLETED
    expect(Array.isArray(floor.body.activeBatches)).toBe(true)
    expect(floor.body.activeBatches.every((b) => !['COMPLETED', 'RETURNED_TO_VAULT', 'CANCELLED', 'SPLIT', 'MERGED'].includes(b.status))).toBe(true)
    expect(floor.body.activeBatches.some((b) => String(b._id) === String(batchId))).toBe(false)
    expect((floor.body.board?.COMPLETED || []).some((b) => String(b._id) === String(batchId))).toBe(true)

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

  test('stock in → available → select/allocate → STK linked batch; legacy batches untouched', async () => {
    const user = await createUser({ productionRole: 'production_manager' })
    const headers = auth(user)

    const legacy = await request(app)
      .post('/api/erp/production-control/batches')
      .set(headers)
      .send({ metalType: 'Gold', purity: '18K', initialWeight: 200, purpose: 'legacy' })
    expect(legacy.status).toBe(201)
    expect(legacy.body.batch.stockCode || '').toBe('')

    const createStock = await request(app)
      .post('/api/erp/production-control/stock')
      .set(headers)
      .send({
        product: 'Bangle 1',
        productCode: 'BG-1',
        quantity: 50,
        netWeight: 250,
        metalType: 'Gold',
        purity: '22K',
        supplier: 'Test Supplier',
        purchaseRef: 'PO-100',
        idempotencyKey: 'stock-create-1',
      })
    expect(createStock.status).toBe(201)
    expect(createStock.body.lot.stockCode).toMatch(/^STK-\d{4}-\d{5}$/)
    expect(createStock.body.lot.status).toBe('NEW_STOCK')

    const reuse = await request(app)
      .post('/api/erp/production-control/stock')
      .set(headers)
      .send({
        product: 'Bangle 1',
        netWeight: 250,
        metalType: 'Gold',
        idempotencyKey: 'stock-create-1',
      })
    expect(reuse.status).toBe(200)
    expect(reuse.body.reused).toBe(true)

    const lotId = createStock.body.lot._id
    const avail = await request(app)
      .post(`/api/erp/production-control/stock/${lotId}/available`)
      .set(headers)
      .send({})
    expect(avail.status).toBe(200)
    expect(avail.body.lot.status).toBe('AVAILABLE')

    const select = await request(app)
      .post('/api/erp/production-control/stock/select')
      .set(headers)
      .send({ stockLotId: lotId, weight: 250, quantity: 50, markIssued: true })
    expect(select.status).toBe(201)
    expect(select.body.batch.stockCode).toBe(createStock.body.lot.stockCode)
    expect(select.body.lot.status).toBe('UNDER_PROCESSING')

    const again = await request(app)
      .post('/api/erp/production-control/stock/select')
      .set(headers)
      .send({ stockLotId: lotId, weight: 10 })
    expect(again.status).toBe(400)

    const trace = await request(app)
      .get('/api/erp/production-control/traceability')
      .query({ stockCode: createStock.body.lot.stockCode })
      .set(headers)
    expect(trace.status).toBe(200)
    expect(trace.body.report.stock.stockCode).toBe(createStock.body.lot.stockCode)
    expect(trace.body.report.batch._id).toBe(select.body.batch._id)

    // Legacy batch still present and unchanged
    const still = await ProductionBatch.findById(legacy.body.batch._id)
    expect(still).toBeTruthy()
    expect(still.stockCode || '').toBe('')
  })

  test('QC PASS routes batch to packaging; packing complete finishes stock', async () => {
    const user = await createUser({ productionRole: 'production_manager' })
    const headers = auth(user)

    const stock = await request(app)
      .post('/api/erp/production-control/stock')
      .set(headers)
      .send({ product: 'Ring', netWeight: 100, metalType: 'Gold', quantity: 10 })
    const lotId = stock.body.lot._id
    await request(app).post(`/api/erp/production-control/stock/${lotId}/available`).set(headers).send({})
    const allocated = await request(app)
      .post('/api/erp/production-control/stock/select')
      .set(headers)
      .send({ stockLotId: lotId, weight: 100, markIssued: true })
    const batchId = allocated.body.batch._id

    const qc = await request(app)
      .post('/api/erp/production-control/qc')
      .set(headers)
      .send({ batchId, result: 'PASS', remarks: 'Good' })
    expect(qc.status).toBe(201)
    expect(qc.body.batch.currentDepartment).toBe('packing')
    expect(qc.body.batch.status).toBe('WAITING')

    const start = await request(app)
      .post('/api/erp/production-control/processes/start')
      .set(headers)
      .send({ batchId, process: 'Packing', department: 'packing', inputWeight: 100 })
    expect(start.status).toBe(201)

    const done = await request(app)
      .post(`/api/erp/production-control/processes/${start.body.processRun._id}/complete`)
      .set(headers)
      .send({
        outputWeight: 98,
        scrap: 1,
        loss: 1,
        details: { packagingType: 'box', packageNumber: 'PKG-1', recovery: 0 },
      })
    expect(done.status).toBe(200)
    expect(done.body.batch.status).toBe('COMPLETED')

    const lot = await request(app).get(`/api/erp/production-control/stock/${lotId}`).set(headers)
    expect(lot.status).toBe(200)
    expect(lot.body.lot.status).toBe('FINISHED')
  })

  test('shifts default 09:00–21:00 and floor session login/logout', async () => {
    const user = await createUser({ productionRole: 'floor_manager' })
    const headers = auth(user)

    const shifts = await request(app).get('/api/erp/production-control/shifts').set(headers)
    expect(shifts.status).toBe(200)
    expect(shifts.body.shifts.length).toBeGreaterThanOrEqual(1)
    expect(shifts.body.current.name).toBeTruthy()
    expect(shifts.body.current.startTime).toBe('09:00')
    expect(shifts.body.current.endTime).toBe('21:00')

    const login = await request(app).post('/api/erp/production-control/floor-sessions/login').set(headers).send({})
    expect([200, 201]).toContain(login.status)
    expect(login.body.session.status).toBe('OPEN')

    const logout = await request(app).post('/api/erp/production-control/floor-sessions/logout').set(headers).send({})
    expect(logout.status).toBe(200)
    expect(logout.body.session.status).toBe('CLOSED')
  })

  test('operator cannot adjust stock; manager can with reason', async () => {
    const mgr = await createUser({ productionRole: 'production_manager', email: `mgr2-${Date.now()}@ex.com` })
    const op = await createUser({
      role: 'department_user',
      department: 'production',
      productionRole: 'operator',
      email: `op2-${Date.now()}@ex.com`,
    })
    const createStock = await request(app)
      .post('/api/erp/production-control/stock')
      .set(auth(mgr))
      .send({ product: 'X', netWeight: 50, metalType: 'Silver' })
    const lotId = createStock.body.lot._id

    const denied = await request(app)
      .post(`/api/erp/production-control/stock/${lotId}/adjust`)
      .set(auth(op))
      .send({ weightDelta: -1, reason: 'Correction' })
    expect(denied.status).toBe(403)

    const ok = await request(app)
      .post(`/api/erp/production-control/stock/${lotId}/adjust`)
      .set(auth(mgr))
      .send({ weightDelta: -1, reason: 'Scale correction' })
    expect(ok.status).toBe(200)
    expect(ok.body.lot.netWeight).toBe(49)
  })

  test('issue-from-vault is idempotent and rejects re-issue after ISSUED', async () => {
    const user = await createUser({ productionRole: 'production_manager' })
    const headers = auth(user)
    const item = await InventoryItem.create({
      name: 'Idem Gold',
      type: 'raw_material',
      quantity: 5000,
      unit: 'g',
      weight: 5000,
    })
    const createRes = await request(app)
      .post('/api/erp/production-control/batches')
      .set(headers)
      .send({
        metalType: 'Gold',
        purity: '22K',
        initialWeight: 100,
        inventoryItemId: String(item._id),
      })
    const batchId = createRes.body.batch._id
    const key = `issue-once-${batchId}`

    const first = await request(app)
      .post(`/api/erp/production-control/batches/${batchId}/issue-from-vault`)
      .set(headers)
      .send({ inventoryItemId: String(item._id), weight: 100, idempotencyKey: key })
    expect(first.status).toBe(200)
    expect(first.body.batch.status).toBe('ISSUED')
    expect(first.body.reused).toBe(false)

    const second = await request(app)
      .post(`/api/erp/production-control/batches/${batchId}/issue-from-vault`)
      .set(headers)
      .send({ inventoryItemId: String(item._id), weight: 100, idempotencyKey: key })
    expect(second.status).toBe(200)
    expect(second.body.reused).toBe(true)

    const qty = await InventoryItem.findById(item._id)
    expect(qty.quantity).toBeCloseTo(4900, 3)

    const rejected = await request(app)
      .post(`/api/erp/production-control/batches/${batchId}/issue-from-vault`)
      .set(headers)
      .send({ inventoryItemId: String(item._id), weight: 50, idempotencyKey: `${key}-2` })
    expect(rejected.status).toBe(400)
  })

  test('return-to-vault blocked after COMPLETED; cancel pass reverts IN_TRANSIT', async () => {
    const user = await createUser({ productionRole: 'production_manager' })
    const headers = auth(user)

    const stock = await request(app)
      .post('/api/erp/production-control/stock')
      .set(headers)
      .send({ product: 'Chain', netWeight: 80, metalType: 'Gold', quantity: 8 })
    const lotId = stock.body.lot._id
    await request(app).post(`/api/erp/production-control/stock/${lotId}/available`).set(headers).send({})
    const allocated = await request(app)
      .post('/api/erp/production-control/stock/select')
      .set(headers)
      .send({ stockLotId: lotId, weight: 80, markIssued: true })
    const batchId = allocated.body.batch._id

    await request(app).post('/api/erp/production-control/qc').set(headers).send({ batchId, result: 'PASS' })
    const start = await request(app)
      .post('/api/erp/production-control/processes/start')
      .set(headers)
      .send({ batchId, process: 'Packing', department: 'packing', inputWeight: 80 })
    await request(app)
      .post(`/api/erp/production-control/processes/${start.body.processRun._id}/complete`)
      .set(headers)
      .send({
        outputWeight: 80,
        scrap: 0,
        loss: 0,
        details: { packagingType: 'box', packageNumber: 'PKG-R', recovery: 0 },
      })

    const blocked = await request(app)
      .post(`/api/erp/production-control/batches/${batchId}/return-to-vault`)
      .set(headers)
      .send({})
    expect(blocked.status).toBe(400)

    const item = await InventoryItem.create({
      name: 'Transit Gold',
      type: 'raw_material',
      quantity: 1000,
      unit: 'g',
      weight: 1000,
    })
    const createRes = await request(app)
      .post('/api/erp/production-control/batches')
      .set(headers)
      .send({ metalType: 'Gold', purity: '18K', initialWeight: 50, inventoryItemId: String(item._id) })
    const transitBatchId = createRes.body.batch._id
    await request(app)
      .post(`/api/erp/production-control/batches/${transitBatchId}/issue-from-vault`)
      .set(headers)
      .send({ inventoryItemId: String(item._id), weight: 50 })
    const passRes = await request(app)
      .post('/api/erp/production-control/passes')
      .set(headers)
      .send({
        batchId: transitBatchId,
        fromDepartment: 'vault',
        toDepartment: 'melting',
        weight: 50,
      })
    const passId = passRes.body.pass._id
    await request(app).post(`/api/erp/production-control/passes/${passId}/approve`).set(headers)
    await request(app).post(`/api/erp/production-control/passes/${passId}/issue`).set(headers)

    const inTransit = await ProductionBatch.findById(transitBatchId)
    expect(inTransit.status).toBe('IN_TRANSIT')

    const cancelled = await request(app)
      .post(`/api/erp/production-control/passes/${passId}/cancel`)
      .set(headers)
      .send({ reason: 'Wrong destination' })
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.batch.status).toBe('WAITING')
    expect(cancelled.body.batch.currentDepartment).toBe('vault')
  })

  test('QC FAIL uses QC_FAILED; packing variance holds without FINISHED; dispatch works', async () => {
    const user = await createUser({ productionRole: 'production_manager' })
    const headers = auth(user)

    const stockFail = await request(app)
      .post('/api/erp/production-control/stock')
      .set(headers)
      .send({ product: 'FailLot', netWeight: 40, metalType: 'Gold', quantity: 4 })
    const failLotId = stockFail.body.lot._id
    await request(app).post(`/api/erp/production-control/stock/${failLotId}/available`).set(headers).send({})
    const failAlloc = await request(app)
      .post('/api/erp/production-control/stock/select')
      .set(headers)
      .send({ stockLotId: failLotId, weight: 40, markIssued: true })
    const failBatchId = failAlloc.body.batch._id

    const failQc = await request(app)
      .post('/api/erp/production-control/qc')
      .set(headers)
      .send({ batchId: failBatchId, result: 'FAIL', failureReason: 'Purity off' })
    expect(failQc.status).toBe(201)
    expect(failQc.body.batch.status).toBe('QC_FAILED')

    const floor = await request(app).get('/api/erp/production-control/live-floor').set(headers)
    expect(floor.status).toBe(200)
    expect(floor.body.kpis.qcPending).toBe(0)
    expect(floor.body.kpis.qcFailed).toBeGreaterThanOrEqual(1)
    expect((floor.body.board.PACKAGING || []).some((b) => String(b._id) === String(failBatchId))).toBe(false)

    const stockPack = await request(app)
      .post('/api/erp/production-control/stock')
      .set(headers)
      .send({ product: 'VarLot', netWeight: 100, metalType: 'Gold', quantity: 10 })
    const packLotId = stockPack.body.lot._id
    await request(app).post(`/api/erp/production-control/stock/${packLotId}/available`).set(headers).send({})
    const packAlloc = await request(app)
      .post('/api/erp/production-control/stock/select')
      .set(headers)
      .send({ stockLotId: packLotId, weight: 100, markIssued: true })
    const packBatchId = packAlloc.body.batch._id
    await request(app).post('/api/erp/production-control/qc').set(headers).send({ batchId: packBatchId, result: 'PASS' })
    const start = await request(app)
      .post('/api/erp/production-control/processes/start')
      .set(headers)
      .send({ batchId: packBatchId, process: 'Packing', department: 'packing', inputWeight: 100 })
    const varianceDone = await request(app)
      .post(`/api/erp/production-control/processes/${start.body.processRun._id}/complete`)
      .set(headers)
      .send({
        outputWeight: 70,
        scrap: 0,
        loss: 0,
        details: { packagingType: 'box', packageNumber: 'PKG-V', recovery: 0 },
      })
    expect(varianceDone.status).toBe(200)
    expect(varianceDone.body.batch.status).toBe('HOLD')
    const heldLot = await request(app).get(`/api/erp/production-control/stock/${packLotId}`).set(headers)
    expect(heldLot.body.lot.status).toBe('HOLD')
    expect(heldLot.body.lot.status).not.toBe('FINISHED')

    const stockOk = await request(app)
      .post('/api/erp/production-control/stock')
      .set(headers)
      .send({ product: 'ShipLot', netWeight: 60, metalType: 'Gold', quantity: 6 })
    const okLotId = stockOk.body.lot._id
    await request(app).post(`/api/erp/production-control/stock/${okLotId}/available`).set(headers).send({})
    const okAlloc = await request(app)
      .post('/api/erp/production-control/stock/select')
      .set(headers)
      .send({ stockLotId: okLotId, weight: 60, markIssued: true })
    const okBatchId = okAlloc.body.batch._id
    await request(app).post('/api/erp/production-control/qc').set(headers).send({ batchId: okBatchId, result: 'PASS' })
    const startOk = await request(app)
      .post('/api/erp/production-control/processes/start')
      .set(headers)
      .send({ batchId: okBatchId, process: 'Packing', department: 'packing', inputWeight: 60 })
    await request(app)
      .post(`/api/erp/production-control/processes/${startOk.body.processRun._id}/complete`)
      .set(headers)
      .send({
        outputWeight: 60,
        scrap: 0,
        loss: 0,
        details: { packagingType: 'box', packageNumber: 'PKG-S', recovery: 0 },
      })
    const finished = await request(app).get(`/api/erp/production-control/stock/${okLotId}`).set(headers)
    expect(finished.body.lot.status).toBe('FINISHED')

    const dispatched = await request(app)
      .post(`/api/erp/production-control/stock/${okLotId}/dispatch`)
      .set(headers)
      .send({ reason: 'Customer order' })
    expect(dispatched.status).toBe(200)
    expect(dispatched.body.lot.status).toBe('DISPATCHED')
  })

  test('partial stock select creates remainder lot with genealogy', async () => {
    const user = await createUser()
    const headers = { Authorization: `Bearer ${tokenFor(user)}` }

    const createStock = await request(app)
      .post('/api/erp/production-control/stock')
      .set(headers)
      .send({ product: 'Partial Gold', netWeight: 1000, quantity: 10, metalType: 'Gold', purity: '24K' })
    expect(createStock.status).toBe(201)
    const lotId = createStock.body.lot._id
    await request(app).post(`/api/erp/production-control/stock/${lotId}/available`).set(headers).send({})

    const select = await request(app)
      .post('/api/erp/production-control/stock/select')
      .set(headers)
      .send({ stockLotId: lotId, weight: 400, quantity: 4, markIssued: true })
    expect(select.status).toBe(201)
    expect(select.body.batch.initialWeight).toBe(400)
    expect(select.body.lot.netWeight).toBe(400)
    expect(select.body.remainderLot).toBeTruthy()
    expect(select.body.remainderLot.status).toBe('AVAILABLE')
    expect(select.body.remainderLot.netWeight).toBe(600)
    expect(select.body.remainderLot.parentLotId).toBe(String(lotId))

    const rem = await request(app)
      .get(`/api/erp/production-control/stock/${select.body.remainderLot._id}`)
      .set(headers)
    expect(rem.status).toBe(200)
    expect(rem.body.lot.status).toBe('AVAILABLE')
  })

  test('batch split and merge preserve genealogy', async () => {
    const user = await createUser()
    const headers = { Authorization: `Bearer ${tokenFor(user)}` }

    const a = await request(app)
      .post('/api/erp/production-control/batches')
      .set(headers)
      .send({ metalType: 'Gold', purity: '24K', initialWeight: 1000, product: 'SplitMe' })
    expect(a.status).toBe(201)
    const parentId = a.body.batch._id

    const split = await request(app)
      .post(`/api/erp/production-control/batches/${parentId}/split`)
      .set(headers)
      .send({ parts: [{ weight: 400 }, { weight: 600 }], reason: 'Line split' })
    expect(split.status).toBe(201)
    expect(split.body.parent.status).toBe('SPLIT')
    expect(split.body.children).toHaveLength(2)
    expect(Number(split.body.children[0].currentWeight) + Number(split.body.children[1].currentWeight)).toBe(1000)

    const b1 = await request(app)
      .post('/api/erp/production-control/batches')
      .set(headers)
      .send({ metalType: 'Gold', purity: '24K', initialWeight: 200, product: 'MergeA' })
    const b2 = await request(app)
      .post('/api/erp/production-control/batches')
      .set(headers)
      .send({ metalType: 'Gold', purity: '24K', initialWeight: 300, product: 'MergeB' })

    const merge = await request(app)
      .post('/api/erp/production-control/batches/merge')
      .set(headers)
      .send({
        batchIds: [b1.body.batch._id, b2.body.batch._id],
        reason: 'Combine lots',
      })
    expect(merge.status).toBe(201)
    expect(merge.body.merged.currentWeight).toBe(500)
    expect(merge.body.parents.every((p) => p.status === 'MERGED')).toBe(true)
    expect(merge.body.parents.every((p) => String(p.mergedIntoBatchId) === String(merge.body.merged._id))).toBe(true)
  })

  test('maintenance work orders create complete and evaluate overdue', async () => {
    const user = await createUser()
    const headers = { Authorization: `Bearer ${tokenFor(user)}` }

    const machine = await request(app)
      .post('/api/erp/production-control/machines')
      .set(headers)
      .send({ machineCode: `M-${Date.now()}`, name: 'Furnace 1', department: 'melting' })
    expect(machine.status).toBe(201)

    const create = await request(app)
      .post('/api/erp/production-control/maintenance')
      .set(headers)
      .send({
        machineId: machine.body.machine._id,
        type: 'PREVENTIVE',
        title: 'Quarterly service',
        technicianName: 'Tech A',
        scheduledAt: new Date(Date.now() - 86400000).toISOString(),
        nextMaintenanceAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        setMachineStatus: 'MAINTENANCE',
      })
    expect(create.status).toBe(201)
    expect(create.body.workOrder.woNumber).toMatch(/^PM-\d{4}-\d{5}$/)

    const list = await request(app).get('/api/erp/production-control/maintenance').set(headers)
    expect(list.status).toBe(200)
    expect(list.body.workOrders.length).toBeGreaterThanOrEqual(1)

    const done = await request(app)
      .post(`/api/erp/production-control/maintenance/${create.body.workOrder._id}/complete`)
      .set(headers)
      .send({ downtimeMinutes: 45, cost: 120, machineStatus: 'IDLE' })
    expect(done.status).toBe(200)
    expect(done.body.workOrder.status).toBe('COMPLETED')

    const evalRes = await request(app)
      .post('/api/erp/production-control/maintenance/evaluate-overdue')
      .set(headers)
      .send({})
    expect(evalRes.status).toBe(200)
    expect(Array.isArray(evalRes.body.alerts)).toBe(true)
  })
})
