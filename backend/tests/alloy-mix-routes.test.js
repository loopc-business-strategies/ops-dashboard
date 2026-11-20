const request = require('supertest')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')
const createApp = require('../app')
const InventoryItem = require('../models/InventoryItem')
const StockMovement = require('../models/StockMovement')
const User = require('../models/User')
const ChartOfAccount = require('../models/ChartOfAccount')
const AccountMapping = require('../models/AccountMapping')
const Ledger = require('../models/Ledger')
const Transaction = require('../models/Transaction')
const AlloyMixJob = require('../models/AlloyMixJob')
const ProductionStockLot = require('../models/ProductionStockLot')
const ProductionStockStatusEvent = require('../models/ProductionStockStatusEvent')
const OperationsProductionEntry = require('../models/OperationsProductionEntry')
const FloorBatchEntry = require('../models/FloorBatchEntry')
const { ALLOY_METAL_LOSS_MAPPING_TYPE } = require('../services/erpAccounting/alloyMixService')

let mongo
let app

const TEST_TENANT = 'mg'
const tokenFor = (user) => jwt.sign({ id: user._id.toString(), company: TEST_TENANT }, process.env.JWT_SECRET)
const authHeader = (user) => ({
  Authorization: `Bearer ${tokenFor(user)}`,
  'x-tenant': TEST_TENANT,
  'x-company': TEST_TENANT,
})

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.RATE_LIMIT_MAX = '100000'
  process.env.AUTH_RATE_LIMIT_MAX = '100000'
  process.env.DEFAULT_TENANT = TEST_TENANT

  mongo = await startMongoMemoryServer()
  const mongoUri = mongo.getUri()
  process.env.MONGO_URI = mongoUri
  process.env.MONGO_URI_LOOPC = mongoUri
  process.env.MONGO_URI_MG = mongoUri
  process.env.MONGO_URI_CG = mongoUri

  await mongoose.connect(mongoUri)
  app = createApp()
})

afterEach(async () => {
  if (!isMongooseConnected(mongoose)) return
  await Promise.all([
    InventoryItem.deleteMany({}),
    StockMovement.deleteMany({}),
    ChartOfAccount.deleteMany({}),
    AccountMapping.deleteMany({}),
    Ledger.deleteMany({}),
    Transaction.deleteMany({}),
    User.deleteMany({}),
    AlloyMixJob.deleteMany({}),
    ProductionStockLot.deleteMany({}),
    ProductionStockStatusEvent.deleteMany({}),
    OperationsProductionEntry.deleteMany({}),
    FloorBatchEntry.deleteMany({}),
  ])
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

async function seedHttpFixture() {
  const user = await User.create({
    name: 'alloy-http-user',
    email: 'alloy-http@example.com',
    password: 'password123',
    role: 'super_admin',
  })
  const invAcct = await ChartOfAccount.create({
    accountName: 'Metal Inventory',
    accountCode: '1300',
    accountType: 'Asset',
    createdBy: user._id,
  })
  const lossParty = await ChartOfAccount.create({
    accountName: 'Metal Loss',
    accountCode: 'AML',
    accountType: 'Expense',
    createdBy: user._id,
  })
  await AccountMapping.create({
    mappingType: ALLOY_METAL_LOSS_MAPPING_TYPE,
    debitAccountId: lossParty._id,
    creditAccountId: invAcct._id,
    isActive: true,
    description: 'alloy loss',
  })

  const fineGold = await InventoryItem.create({
    name: 'Gold 24K Bar',
    sku: 'AU-24K',
    category: 'mainStock=gold;metalType=gold;recordType=product;productPurity=1',
    quantity: 100,
    unit: 'grams',
    unitCost: 50,
    ledgerAccountId: invAcct._id,
    createdBy: user._id,
    updatedBy: user._id,
  })
  await StockMovement.create({
    itemId: fineGold._id,
    itemName: fineGold.name,
    change: 100,
    quantityBefore: 0,
    quantityAfter: 100,
    reason: 'seed',
    actorId: user._id,
    actorName: user.name,
  })

  const silver = await InventoryItem.create({
    name: 'Fine Silver',
    sku: 'AG-FINE',
    category: 'mainStock=silver;metalType=silver;recordType=product;productPurity=0.999',
    quantity: 100,
    unit: 'grams',
    unitCost: 1,
    ledgerAccountId: invAcct._id,
    createdBy: user._id,
    updatedBy: user._id,
  })
  await StockMovement.create({
    itemId: silver._id,
    itemName: silver.name,
    change: 100,
    quantityBefore: 0,
    quantityAfter: 100,
    reason: 'seed',
    actorId: user._id,
    actorName: user.name,
  })

  const finished = await InventoryItem.create({
    name: '14k alloyed gold',
    sku: 'AU-14K',
    category: 'mainStock=gold;metalType=gold;recordType=product;productPurity=0.585',
    quantity: 0,
    unit: 'grams',
    unitCost: 0,
    ledgerAccountId: invAcct._id,
    createdBy: user._id,
    updatedBy: user._id,
  })

  return { user, fineGold, silver, finished }
}

describe('alloy-mix HTTP routes', () => {
  test('post → jobs → allocate → reverse → clear-history', async () => {
    const { user, fineGold, silver, finished } = await seedHttpFixture()
    const headers = authHeader(user)

    const postRes = await request(app)
      .post('/api/erp-accounting/inventory/alloy-mix')
      .set(headers)
      .send({
        karat: 14,
        targetGross: 80,
        finishedProductId: String(finished._id),
        lines: [
          { itemId: String(fineGold._id), gross: 50, role: 'gold', label: 'gold' },
          { itemId: String(silver._id), gross: 35, role: 'silver', label: 'silver' },
        ],
      })

    expect(postRes.status).toBe(201)
    expect(postRes.body.success).toBe(true)
    expect(postRes.body.mixJob?.mixCode).toBe('BMG-0001')
    const reason = postRes.body.reason
    const jobId = postRes.body.mixJob.id

    const jobsRes = await request(app)
      .get('/api/erp-accounting/inventory/alloy-mix/jobs')
      .query({ department: 'vault_room' })
      .set(headers)
    expect(jobsRes.status).toBe(200)
    expect(jobsRes.body.success).toBe(true)
    expect(jobsRes.body.jobs.some((j) => j.id === jobId)).toBe(true)

    const vaultBefore = await OperationsProductionEntry.find({
      alloyMixCode: 'BMG-0001',
      departmentKey: 'vault_room',
      source: 'gold_alloy',
    }).lean()
    expect(vaultBefore).toHaveLength(1)
    expect(vaultBefore[0].metalIn).toBeGreaterThan(0)
    expect(vaultBefore[0].metalOut == null).toBe(true)

    const allocRes = await request(app)
      .post(`/api/erp-accounting/inventory/alloy-mix/jobs/${jobId}/allocate`)
      .set(headers)
      .send({ toDepartment: 'melting' })
    expect(allocRes.status).toBe(200)
    expect(allocRes.body.success).toBe(true)
    expect(allocRes.body.job.currentDepartment).toBe('melting')
    expect(allocRes.body.job.status).toBe('pending_receive')
    expect(allocRes.body.pendingReceive).toBe(true)

    const vaultAfterOut = await OperationsProductionEntry.find({
      alloyMixCode: 'BMG-0001',
      departmentKey: 'vault_room',
      source: 'gold_alloy',
    }).lean()
    expect(vaultAfterOut).toHaveLength(1)
    expect(vaultAfterOut[0].metalIn).toBe(vaultAfterOut[0].metalOut)

    // Melting shows Metal IN as soon as Vault allocates (before receive Approve).
    const meltingBeforeRecv = await OperationsProductionEntry.find({
      alloyMixCode: 'BMG-0001',
      departmentKey: 'melting',
      source: 'gold_alloy',
    }).lean()
    expect(meltingBeforeRecv).toHaveLength(1)
    expect(meltingBeforeRecv[0].metalIn).toBeGreaterThan(0)
    expect(meltingBeforeRecv[0].metalOut == null).toBe(true)

    const recvRes = await request(app)
      .post(`/api/mg-floor/alloy-mix-jobs/${jobId}/receive`)
      .set(headers)
      .send({ decision: 'APPROVED' })
    expect(recvRes.status).toBe(200)
    expect(recvRes.body.job.status).toBe('in_department')

    const meltingRows = await OperationsProductionEntry.find({
      alloyMixCode: 'BMG-0001',
      departmentKey: 'melting',
      source: 'gold_alloy',
    }).lean()
    // Receive must not create a second Melting visit.
    expect(meltingRows).toHaveLength(1)
    expect(meltingRows[0].metalIn).toBeGreaterThan(0)

    const blocked = await request(app)
      .post('/api/erp-accounting/inventory/alloy-mix/reverse')
      .set(headers)
      .send({ reason })
    expect(blocked.status).toBe(400)

    const backRes = await request(app)
      .post(`/api/erp-accounting/inventory/alloy-mix/jobs/${jobId}/allocate`)
      .set(headers)
      .send({ toDepartment: 'vault_room' })
    expect(backRes.status).toBe(200)
    expect(backRes.body.job.currentDepartment).toBe('vault_room')

    const meltingAfterReturn = await OperationsProductionEntry.find({
      alloyMixCode: 'BMG-0001',
      departmentKey: 'melting',
      source: 'gold_alloy',
    }).lean()
    expect(meltingAfterReturn).toHaveLength(1)
    expect(meltingAfterReturn[0].metalOut).toBe(meltingAfterReturn[0].metalIn)

    const vaultAfterReturn = await OperationsProductionEntry.find({
      alloyMixCode: 'BMG-0001',
      departmentKey: 'vault_room',
      source: 'gold_alloy',
    }).lean()
    expect(vaultAfterReturn).toHaveLength(2)
    const openVault = vaultAfterReturn.find((r) => r.metalOut == null)
    expect(openVault?.metalIn).toBeGreaterThan(0)

    const toBangle = await request(app)
      .post(`/api/erp-accounting/inventory/alloy-mix/jobs/${jobId}/allocate`)
      .set(headers)
      .send({ toDepartment: 'bangle_area' })
    expect(toBangle.status).toBe(200)
    expect(toBangle.body.job.currentDepartment).toBe('bangle_area')

    // Melting visit history stays after Vault → Bangle.
    const meltingAfterBangle = await OperationsProductionEntry.find({
      alloyMixCode: 'BMG-0001',
      departmentKey: 'melting',
      source: 'gold_alloy',
    }).lean()
    expect(meltingAfterBangle).toHaveLength(1)
    expect(meltingAfterBangle[0].metalOut).toBe(meltingAfterBangle[0].metalIn)

    const bangleRows = await OperationsProductionEntry.find({
      alloyMixCode: 'BMG-0001',
      departmentKey: 'bangle_area',
      source: 'gold_alloy',
    }).lean()
    expect(bangleRows).toHaveLength(1)
    expect(bangleRows[0].metalIn).toBeGreaterThan(0)
    expect(bangleRows[0].metalOut == null).toBe(true)

    const recvBangle = await request(app)
      .post(`/api/mg-floor/alloy-mix-jobs/${jobId}/receive`)
      .set(headers)
      .send({ decision: 'APPROVED' })
    expect(recvBangle.status).toBe(200)
    expect(recvBangle.body.job.status).toBe('in_department')
    const bangleAfterRecv = await OperationsProductionEntry.find({
      alloyMixCode: 'BMG-0001',
      departmentKey: 'bangle_area',
      source: 'gold_alloy',
    }).lean()
    expect(bangleAfterRecv).toHaveLength(1)

    // Return to vault so reverse is allowed (active floor custody blocks reverse).
    const backVault = await request(app)
      .post(`/api/erp-accounting/inventory/alloy-mix/jobs/${jobId}/allocate`)
      .set(headers)
      .send({ toDepartment: 'vault_room' })
    expect(backVault.status).toBe(200)
    expect(backVault.body.job.currentDepartment).toBe('vault_room')

    const bangleClosed = await OperationsProductionEntry.find({
      alloyMixCode: 'BMG-0001',
      departmentKey: 'bangle_area',
      source: 'gold_alloy',
    }).lean()
    expect(bangleClosed).toHaveLength(1)
    expect(bangleClosed[0].metalOut).toBe(bangleClosed[0].metalIn)

    const reverseRes = await request(app)
      .post('/api/erp-accounting/inventory/alloy-mix/reverse')
      .set(headers)
      .send({ reason })
    expect(reverseRes.status).toBe(200)
    expect(reverseRes.body.success).toBe(true)

    // Update/reverse keeps completed dept visits (same BMG batch history).
    const meltingKept = await OperationsProductionEntry.find({
      alloyMixCode: 'BMG-0001',
      departmentKey: 'melting',
      source: 'gold_alloy',
    }).lean()
    expect(meltingKept).toHaveLength(1)
    expect(meltingKept[0].metalOut).toBe(meltingKept[0].metalIn)
    expect(meltingKept[0].batchOverAt).toBeTruthy()

    const bangleKept = await OperationsProductionEntry.find({
      alloyMixCode: 'BMG-0001',
      departmentKey: 'bangle_area',
      source: 'gold_alloy',
    }).lean()
    expect(bangleKept).toHaveLength(1)
    expect(bangleKept[0].metalOut).toBe(bangleKept[0].metalIn)
    expect(bangleKept[0].batchOverAt).toBeTruthy()

    const vaultOpenGone = await OperationsProductionEntry.find({
      alloyMixCode: 'BMG-0001',
      departmentKey: 'vault_room',
      source: 'gold_alloy',
      $or: [{ metalOut: null }, { metalOut: { $exists: false } }],
    }).lean()
    expect(vaultOpenGone).toHaveLength(0)

    const clearRes = await request(app)
      .post('/api/erp-accounting/inventory/alloy-mix/clear-history')
      .set(headers)
      .send({ reason })
    expect(clearRes.status).toBe(200)
    expect(clearRes.body.success).toBe(true)
    expect(Number(clearRes.body.deletedCount)).toBeGreaterThanOrEqual(0)
  })

  test('allocate with weight splits child job via HTTP', async () => {
    const { user, fineGold, silver, finished } = await seedHttpFixture()
    const headers = authHeader(user)

    const postRes = await request(app)
      .post('/api/erp-accounting/inventory/alloy-mix')
      .set(headers)
      .send({
        karat: 14,
        targetGross: 80,
        finishedProductId: String(finished._id),
        lines: [
          { itemId: String(fineGold._id), gross: 50, role: 'gold', label: 'gold' },
          { itemId: String(silver._id), gross: 35, role: 'silver', label: 'silver' },
        ],
      })
    expect(postRes.status).toBe(201)
    const jobId = postRes.body.mixJob.id
    const reason = postRes.body.reason

    const splitRes = await request(app)
      .post(`/api/erp-accounting/inventory/alloy-mix/jobs/${jobId}/allocate`)
      .set(headers)
      .send({ toDepartment: 'melting', weight: 30 })
    expect(splitRes.status).toBe(200)
    expect(splitRes.body.success).toBe(true)
    expect(splitRes.body.partial).toBe(true)
    expect(Number(splitRes.body.parentJob?.targetGross)).toBe(50)
    expect(splitRes.body.parentJob?.currentDepartment).toBe('vault_room')
    expect(Number(splitRes.body.childJob?.targetGross)).toBe(30)
    expect(splitRes.body.childJob?.currentDepartment).toBe('melting')
    expect(splitRes.body.childJob?.status).toBe('pending_receive')
    expect(splitRes.body.pendingReceive).toBe(true)
    expect(splitRes.body.childJob?.mixCode).toBeTruthy()

    const childId = splitRes.body.childJob.id
    const recvChild = await request(app)
      .post(`/api/mg-floor/alloy-mix-jobs/${childId}/receive`)
      .set(headers)
      .send({ decision: 'APPROVED' })
    expect(recvChild.status).toBe(200)
    expect(recvChild.body.job.status).toBe('in_department')

    const backChild = await request(app)
      .post(`/api/erp-accounting/inventory/alloy-mix/jobs/${childId}/allocate`)
      .set(headers)
      .send({ toDepartment: 'vault_room' })
    expect(backChild.status).toBe(200)
    expect(backChild.body.job.currentDepartment).toBe('vault_room')

    const reverseRes = await request(app)
      .post('/api/erp-accounting/inventory/alloy-mix/reverse')
      .set(headers)
      .send({ reason })
    expect(reverseRes.status).toBe(200)

    const clearRes = await request(app)
      .post('/api/erp-accounting/inventory/alloy-mix/clear-history')
      .set(headers)
      .send({ reason })
    expect(clearRes.status).toBe(200)
  })

  test('update reuses same BMG batch; new mix gets next number', async () => {
    const { user, fineGold, silver, finished } = await seedHttpFixture()
    const headers = authHeader(user)

    const post1 = await request(app)
      .post('/api/erp-accounting/inventory/alloy-mix')
      .set(headers)
      .send({
        karat: 14,
        targetGross: 80,
        finishedProductId: String(finished._id),
        lines: [
          { itemId: String(fineGold._id), gross: 50, role: 'gold', label: 'gold' },
          { itemId: String(silver._id), gross: 35, role: 'silver', label: 'silver' },
        ],
      })
    expect(post1.status).toBe(201)
    expect(post1.body.mixJob?.mixCode).toBe('BMG-0001')
    const reason1 = post1.body.reason

    const reverse1 = await request(app)
      .post('/api/erp-accounting/inventory/alloy-mix/reverse')
      .set(headers)
      .send({ reason: reason1 })
    expect(reverse1.status).toBe(200)

    const updatePost = await request(app)
      .post('/api/erp-accounting/inventory/alloy-mix')
      .set(headers)
      .send({
        karat: 14,
        targetGross: 80,
        finishedProductId: String(finished._id),
        reuseMixCode: 'BMG-0001',
        lines: [
          { itemId: String(fineGold._id), gross: 50, role: 'gold', label: 'gold' },
          { itemId: String(silver._id), gross: 35, role: 'silver', label: 'silver' },
        ],
      })
    expect(updatePost.status).toBe(201)
    expect(updatePost.body.mixJob?.mixCode).toBe('BMG-0001')

    const post2 = await request(app)
      .post('/api/erp-accounting/inventory/alloy-mix')
      .set(headers)
      .send({
        karat: 14,
        targetGross: 40,
        finishedProductId: String(finished._id),
        lines: [
          { itemId: String(fineGold._id), gross: 25, role: 'gold', label: 'gold' },
          { itemId: String(silver._id), gross: 18, role: 'silver', label: 'silver' },
        ],
      })
    expect(post2.status).toBe(201)
    expect(post2.body.mixJob?.mixCode).toBe('BMG-0002')
  })

  test('forbidden without inventory write role', async () => {
    const viewer = await User.create({
      name: 'alloy-viewer',
      email: 'alloy-viewer@example.com',
      password: 'password123',
      role: 'department_user',
      department: 'hr',
    })
    const post = await request(app)
      .post('/api/erp-accounting/inventory/alloy-mix')
      .set(authHeader(viewer))
      .send({
        karat: 14,
        targetGross: 10,
        finishedProductId: new mongoose.Types.ObjectId().toString(),
        lines: [{ itemId: new mongoose.Types.ObjectId().toString(), gross: 10, role: 'gold' }],
      })
    expect(post.status).toBe(403)
  })

  test('clear-history is reason-scoped and skips active movements', async () => {
    const { user, fineGold, silver, finished } = await seedHttpFixture()
    const headers = authHeader(user)

    const postRes = await request(app)
      .post('/api/erp-accounting/inventory/alloy-mix')
      .set(headers)
      .send({
        karat: 14,
        targetGross: 80,
        finishedProductId: String(finished._id),
        lines: [
          { itemId: String(fineGold._id), gross: 50, role: 'gold', label: 'gold' },
          { itemId: String(silver._id), gross: 35, role: 'silver', label: 'silver' },
        ],
      })
    expect(postRes.status).toBe(201)
    const reason = postRes.body.reason

    const activeBefore = await StockMovement.countDocuments({
      isDeleted: { $ne: true },
      reason: new RegExp(String(reason).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    })
    expect(activeBefore).toBeGreaterThan(0)

    const clearActive = await request(app)
      .post('/api/erp-accounting/inventory/alloy-mix/clear-history')
      .set(headers)
      .send({ reason })
    expect(clearActive.status).toBe(200)
    expect(clearActive.body.deletedCount).toBe(0)

    const reverseRes = await request(app)
      .post('/api/erp-accounting/inventory/alloy-mix/reverse')
      .set(headers)
      .send({ reason })
    expect(reverseRes.status).toBe(200)

    const softDeleted = await StockMovement.countDocuments({
      isDeleted: true,
      reason: new RegExp(String(reason).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    })
    expect(softDeleted).toBeGreaterThan(0)

    const clearHist = await request(app)
      .post('/api/erp-accounting/inventory/alloy-mix/clear-history')
      .set(headers)
      .send({ reason })
    expect(clearHist.status).toBe(200)
    expect(Number(clearHist.body.deletedCount)).toBe(softDeleted)

    const leftover = await StockMovement.countDocuments({
      isDeleted: true,
      reason: new RegExp(String(reason).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    })
    expect(leftover).toBe(0)

    const missing = await request(app)
      .post('/api/erp-accounting/inventory/alloy-mix/clear-history')
      .set(headers)
      .send({})
    expect(missing.status).toBe(400)

    const forbidden = await request(app)
      .post('/api/erp-accounting/inventory/alloy-mix/clear-history')
      .set(authHeader(await User.create({
        name: 'alloy-clear-viewer',
        email: 'alloy-clear-viewer@example.com',
        password: 'password123',
        role: 'department_user',
        department: 'hr',
      })))
      .send({ reason: 'x' })
    expect(forbidden.status).toBe(403)
  })
})
