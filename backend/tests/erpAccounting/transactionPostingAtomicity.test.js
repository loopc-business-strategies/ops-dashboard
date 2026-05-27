const request = require('supertest')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
} = require('../mongoMemoryTestServer')

const createApp = require('../../app')
const User = require('../../models/User')
const Transaction = require('../../models/Transaction')
const Customer = require('../../models/Customer')
const InventoryItem = require('../../models/InventoryItem')
const StockMovement = require('../../models/StockMovement')
const Ledger = require('../../models/Ledger')
const ChartOfAccount = require('../../models/ChartOfAccount')
const Currency = require('../../models/Currency')
const { connectTenant } = require('../../db/tenantConnections')
const { registerAllOnConnection } = require('../../db/tenantModelRegistry')

jest.setTimeout(120000)

let mongo
let app

const TEST_TENANT = 'loopc'
const tokenFor = (user) => jwt.sign({ id: user._id.toString(), company: TEST_TENANT }, process.env.JWT_SECRET)
const authHeader = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` })

const getTenantModels = async () => {
  const connection = await connectTenant(TEST_TENANT)
  registerAllOnConnection(connection)
  return {
    StockMovement: connection.models.StockMovement,
    Transaction: connection.models.Transaction,
  }
}

const createUser = async (overrides = {}) => {
  const now = Date.now().toString(36)
  return User.create({
    name: `finance-${now}`,
    email: `finance-${now}@example.com`,
    password: 'password123',
    role: 'department_head',
    department: 'finance',
    ...overrides,
  })
}

const createApprovedSaleTransaction = async (financeUser, { item, customer, receivableAccount, inventoryAccount }) => {
  const createRes = await request(app)
    .post('/api/erp-accounting/transactions')
    .set(authHeader(financeUser))
    .send({
      type: 'sale',
      amount: 1500,
      description: 'Atomicity test sale',
      currency: 'USD',
      customerId: customer._id.toString(),
      voucherMeta: {
        vocNo: `AT-${Date.now()}`,
        lineItems: [
          {
            stockCode: item.sku,
            productType: item.name,
            grossWeight: 10,
            amountLC: 1500,
          },
        ],
      },
    })

  expect(createRes.status).toBe(201)
  const txId = createRes.body.transaction._id

  await request(app)
    .post(`/api/erp-accounting/transactions/${txId}/submit`)
    .set(authHeader(financeUser))
    .send({ comment: 'submit' })
    .expect(200)

  await request(app)
    .post(`/api/erp-accounting/transactions/${txId}/approve`)
    .set(authHeader(financeUser))
    .send({ comment: 'approve' })
    .expect(200)

  return { txId, receivableAccount, inventoryAccount, item }
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.RATE_LIMIT_MAX = '100000'
  process.env.AUTH_RATE_LIMIT_MAX = '100000'
  process.env.DEFAULT_TENANT = TEST_TENANT
  process.env.SERVER_BASE_URL = 'http://localhost:5000'

  mongo = await startMongoMemoryServer()
  const mongoUri = mongo.getUri()
  process.env.MONGO_URI = mongoUri
  process.env.MONGO_URI_LOOPC = mongoUri
  process.env.MONGO_URI_MG = mongoUri
  process.env.MONGO_URI_CG = mongoUri

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 60000,
    maxPoolSize: 1,
  })

  const registry = require('../../db/tenantModelRegistry')
  registry.registerAllOnConnection(mongoose.connection)

  app = createApp()
})

afterEach(async () => {
  jest.restoreAllMocks()
  if (isMongooseConnected(mongoose)) {
    await Promise.all([
      User.deleteMany({}),
      Transaction.deleteMany({}),
      Customer.deleteMany({}),
      InventoryItem.deleteMany({}),
      StockMovement.deleteMany({}),
      Ledger.deleteMany({}),
      ChartOfAccount.deleteMany({}),
      Currency.deleteMany({}),
    ])
  }
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('transaction posting atomicity', () => {
  test('rolls back ledger and inventory when stock movement creation fails mid-post', async () => {
    const financeUser = await createUser()
    const receivableAccount = await ChartOfAccount.create({
      accountName: 'Customer Receivable',
      accountCode: '1201',
      accountType: 'Asset',
      createdBy: financeUser._id,
    })
    const inventoryAccount = await ChartOfAccount.create({
      accountName: 'Gold Inventory',
      accountCode: '1301',
      accountType: 'Asset',
      createdBy: financeUser._id,
    })
    const customer = await Customer.create({
      name: 'Atomic Buyer',
      ledgerAccountId: receivableAccount._id,
      createdBy: financeUser._id,
    })
    const item = await InventoryItem.create({
      name: 'kilo bar 995',
      sku: 'GOLD-AT-995',
      category: 'recordType=product',
      quantity: 100,
      unit: 'grams',
      unitCost: 50,
      ledgerAccountId: inventoryAccount._id,
      createdBy: financeUser._id,
      updatedBy: financeUser._id,
    })

    const { txId } = await createApprovedSaleTransaction(financeUser, {
      item,
      customer,
      receivableAccount,
      inventoryAccount,
    })

    const { StockMovement: TenantStockMovement } = await getTenantModels()
    jest.spyOn(TenantStockMovement, 'create').mockRejectedValue(new Error('Simulated mid-post failure'))

    const postRes = await request(app)
      .post(`/api/erp-accounting/transactions/${txId}/post`)
      .set(authHeader(financeUser))
      .send({ comment: 'Post sale voucher' })

    expect(postRes.status).not.toBe(200)

    const tx = await Transaction.findById(txId)
    expect(tx.status).toBe('approved')
    expect(tx.journalEntryId).toBeFalsy()

    const activeLedgers = await Ledger.find({ referenceId: txId, isDeleted: { $ne: true } })
    expect(activeLedgers).toHaveLength(0)

    const refreshedItem = await InventoryItem.findById(item._id)
    expect(Number(refreshedItem.quantity)).toBe(100)

    const stockMovements = await StockMovement.find({ itemId: item._id })
    expect(stockMovements).toHaveLength(0)
  })

  test('rolls back ledger soft-delete and inventory restore when transaction save fails mid-void', async () => {
    const financeUser = await createUser()
    process.env.DESTRUCTIVE_ADMIN_CONFIRM_TOKEN = 'test-destructive-token'

    const receivableAccount = await ChartOfAccount.create({
      accountName: 'Customer Receivable',
      accountCode: '1202',
      accountType: 'Asset',
      createdBy: financeUser._id,
    })
    const inventoryAccount = await ChartOfAccount.create({
      accountName: 'Gold Inventory',
      accountCode: '1302',
      accountType: 'Asset',
      createdBy: financeUser._id,
    })
    const customer = await Customer.create({
      name: 'Void Atomic Buyer',
      ledgerAccountId: receivableAccount._id,
      createdBy: financeUser._id,
    })
    const item = await InventoryItem.create({
      name: 'kilo bar 995',
      sku: 'GOLD-VOID-995',
      category: 'recordType=product',
      quantity: 100,
      unit: 'grams',
      unitCost: 50,
      ledgerAccountId: inventoryAccount._id,
      createdBy: financeUser._id,
      updatedBy: financeUser._id,
    })

    const { txId } = await createApprovedSaleTransaction(financeUser, {
      item,
      customer,
      receivableAccount,
      inventoryAccount,
    })

    await request(app)
      .post(`/api/erp-accounting/transactions/${txId}/post`)
      .set(authHeader(financeUser))
      .send({ comment: 'Post before void' })
      .expect(200)

    const postedItem = await InventoryItem.findById(item._id)
    expect(Number(postedItem.quantity)).toBe(90)

    const activeLedgersBeforeVoid = await Ledger.find({ referenceId: txId, isDeleted: { $ne: true } })
    expect(activeLedgersBeforeVoid.length).toBeGreaterThan(0)

    const { Transaction: TenantTransaction } = await getTenantModels()
    const originalSave = TenantTransaction.prototype.save
    jest.spyOn(TenantTransaction.prototype, 'save').mockImplementation(function saveWithFailure(options) {
      if (this.isDeleted) {
        return Promise.reject(new Error('Simulated mid-void failure'))
      }
      return originalSave.call(this, options)
    })

    const voidRes = await request(app)
      .post(`/api/erp-accounting/transactions/${txId}/void`)
      .set(authHeader(financeUser))
      .send({
        reason: 'Test void rollback failure',
        confirmToken: process.env.DESTRUCTIVE_ADMIN_CONFIRM_TOKEN,
      })

    expect(voidRes.status).toBe(500)

    const tx = await Transaction.findById(txId)
    expect(tx.isDeleted).not.toBe(true)
    expect(tx.status).toBe('posted')

    const activeLedgersAfterFailedVoid = await Ledger.find({ referenceId: txId, isDeleted: { $ne: true } })
    expect(activeLedgersAfterFailedVoid.length).toBe(activeLedgersBeforeVoid.length)

    const itemAfterFailedVoid = await InventoryItem.findById(item._id)
    expect(Number(itemAfterFailedVoid.quantity)).toBe(90)
  })
})
