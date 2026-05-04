const fs = require('fs')
const path = require('path')
const request = require('supertest')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const { MongoMemoryServer } = require('mongodb-memory-server')

const createApp = require('../app')
const User = require('../models/User')
const Transaction = require('../models/Transaction')
const Customer = require('../models/Customer')
const Vendor = require('../models/Vendor')
const InventoryItem = require('../models/InventoryItem')
const StockMovement = require('../models/StockMovement')
const Ledger = require('../models/Ledger')
const ChartOfAccount = require('../models/ChartOfAccount')
const Currency = require('../models/Currency')

jest.setTimeout(30000)

let mongo
let app

const uploadDir = path.join(__dirname, 'tmp-transaction-uploads')

const TEST_TENANT = 'loopc'
const tokenFor = (user) => jwt.sign({ id: user._id.toString(), company: TEST_TENANT }, process.env.JWT_SECRET)

const authHeader = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` })

const createUser = async (overrides = {}) => {
  const now = Date.now().toString(36)
  return User.create({
    name: `finance-${now}-${Math.random().toString(36).slice(2, 8)}`,
    email: `finance-${now}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: 'password123',
    role: 'department_head',
    department: 'finance',
    ...overrides,
  })
}

const createDraftTransaction = async (user, overrides = {}) => Transaction.create({
  type: 'expense',
  amount: 1250,
  date: new Date('2024-05-10T00:00:00.000Z'),
  currency: 'USD',
  exchangeRate: 1,
  description: 'Office expense',
  status: 'draft',
  createdBy: user._id,
  updatedBy: user._id,
  ...overrides,
})

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.RATE_LIMIT_MAX = '100000'
  process.env.AUTH_RATE_LIMIT_MAX = '100000'
  process.env.DEFAULT_TENANT = TEST_TENANT
  process.env.TRANSACTION_UPLOAD_DIR = uploadDir
  process.env.SERVER_BASE_URL = 'http://localhost:5000'

  mongo = await MongoMemoryServer.create()
  const mongoUri = mongo.getUri()
  process.env.MONGO_URI = mongoUri
  process.env.MONGO_URI_LOOPC = mongoUri
  await mongoose.connect(mongoUri)
  app = createApp()
})

afterEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Transaction.deleteMany({}),
    Customer.deleteMany({}),
    Vendor.deleteMany({}),
    InventoryItem.deleteMany({}),
    StockMovement.deleteMany({}),
    Ledger.deleteMany({}),
    ChartOfAccount.deleteMany({}),
    Currency.deleteMany({}),
  ])
  fs.rmSync(uploadDir, { recursive: true, force: true })
})

afterAll(async () => {
  await mongoose.disconnect()
  if (mongo) await mongo.stop()
  fs.rmSync(uploadDir, { recursive: true, force: true })
})

describe('ERP accounting transactions workflow', () => {
  test('adds transaction comments and appends audit history', async () => {
    const financeUser = await createUser()

    const createRes = await request(app)
      .post('/api/erp-accounting/transactions')
      .set(authHeader(financeUser))
      .send({
        type: 'expense',
        amount: 980,
        description: 'Travel reimbursement',
        currency: 'USD',
      })

    expect(createRes.status).toBe(201)

    const commentRes = await request(app)
      .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/comments`)
      .set(authHeader(financeUser))
      .send({ message: 'Receipt matched against approved travel claim.' })

    expect(commentRes.status).toBe(200)
    expect(commentRes.body.transaction.comments).toHaveLength(1)
    expect(commentRes.body.transaction.comments[0].message).toBe('Receipt matched against approved travel claim.')
    expect(commentRes.body.transaction.auditTrail.map((entry) => entry.action)).toEqual(expect.arrayContaining(['create', 'comment']))
  })

  test('bulk submit updates statuses and records submit audit events', async () => {
    const financeUser = await createUser()
    const txOne = await createDraftTransaction(financeUser, { description: 'Expense A' })
    const txTwo = await createDraftTransaction(financeUser, { description: 'Expense B' })

    const bulkRes = await request(app)
      .post('/api/erp-accounting/transactions/bulk-action')
      .set(authHeader(financeUser))
      .send({
        ids: [txOne._id.toString(), txTwo._id.toString()],
        action: 'submit',
        comment: 'Monthly close batch',
      })

    expect(bulkRes.status).toBe(200)
    expect(bulkRes.body.successCount).toBe(2)
    expect(bulkRes.body.failureCount).toBe(0)
    for (const transaction of bulkRes.body.transactions) {
      expect(transaction.status).toBe('submitted')
      expect(transaction.auditTrail.some((entry) => entry.action === 'submit' && entry.comment === 'Monthly close batch')).toBe(true)
    }
  })

  test('uploads attachments and tracks return/reject reasons in audit trail', async () => {
    const financeUser = await createUser({ name: 'Finance Lead' })
    const tx = await createDraftTransaction(financeUser, { description: 'Vendor settlement' })

    const submitRes = await request(app)
      .post(`/api/erp-accounting/transactions/${tx._id}/submit`)
      .set(authHeader(financeUser))
      .send({ comment: 'Ready for review' })

    expect(submitRes.status).toBe(200)

    const attachmentRes = await request(app)
      .post(`/api/erp-accounting/transactions/${tx._id}/attachments`)
      .set(authHeader(financeUser))
      .attach('file', Buffer.from('invoice-support'), { filename: 'invoice.txt', contentType: 'text/plain' })

    expect(attachmentRes.status).toBe(201)
    expect(attachmentRes.body.transaction.attachments).toHaveLength(1)
    expect(attachmentRes.body.transaction.auditTrail.some((entry) => entry.action === 'upload_attachment')).toBe(true)

    const returnRes = await request(app)
      .post(`/api/erp-accounting/transactions/${tx._id}/return`)
      .set(authHeader(financeUser))
      .send({ comment: 'Need corrected VAT split' })

    expect(returnRes.status).toBe(200)
    expect(returnRes.body.transaction.status).toBe('returned')
    expect(returnRes.body.transaction.comments.some((entry) => entry.kind === 'return_note' && entry.message === 'Need corrected VAT split')).toBe(true)

    const rejectRes = await request(app)
      .post(`/api/erp-accounting/transactions/${tx._id}/reject`)
      .set(authHeader(financeUser))
      .send({ comment: 'Duplicate source document' })

    expect(rejectRes.status).toBe(200)
    expect(rejectRes.body.transaction.status).toBe('rejected')
    expect(rejectRes.body.transaction.auditTrail.some((entry) => entry.action === 'reject' && entry.comment === 'Duplicate source document')).toBe(true)
  })

  test('posting sale voucher updates customer ledger, stock, sales revenue, cogs, and balances', async () => {
    const financeUser = await createUser({ name: 'Finance Poster' })
    const receivableAccount = await ChartOfAccount.create({
      accountName: 'Customer Receivable - Test',
      accountCode: '1201',
      accountType: 'Asset',
      createdBy: financeUser._id,
    })
    const inventoryAccount = await ChartOfAccount.create({
      accountName: 'Gold Inventory - Test',
      accountCode: '1301',
      accountType: 'Asset',
      createdBy: financeUser._id,
    })
    const customer = await Customer.create({
      name: 'Gold Buyer',
      ledgerAccountId: receivableAccount._id,
      createdBy: financeUser._id,
    })
    const item = await InventoryItem.create({
      name: 'kilo bar 995',
      sku: 'GOLD-995',
      category: 'recordType=product',
      quantity: 100,
      unit: 'grams',
      unitCost: 50,
      ledgerAccountId: inventoryAccount._id,
      createdBy: financeUser._id,
      updatedBy: financeUser._id,
    })

    const createRes = await request(app)
      .post('/api/erp-accounting/transactions')
      .set(authHeader(financeUser))
      .send({
        type: 'sale',
        amount: 1500,
        description: 'Metal sale voucher',
        currency: 'USD',
        customerId: customer._id.toString(),
        voucherMeta: {
          vocNo: '101',
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

    const submitRes = await request(app)
      .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/submit`)
      .set(authHeader(financeUser))
      .send({ comment: 'Ready to post' })
    expect(submitRes.status).toBe(200)

    const postRes = await request(app)
      .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/post`)
      .set(authHeader(financeUser))
      .send({ comment: 'Post sale voucher' })

    expect(postRes.status).toBe(200)
    expect(postRes.body.transaction.status).toBe('posted')

    const updatedItem = await InventoryItem.findById(item._id)
    expect(Number(updatedItem.quantity)).toBe(90)

    const stockMovements = await StockMovement.find({ itemId: item._id })
    expect(stockMovements).toHaveLength(1)
    expect(Number(stockMovements[0].change)).toBe(-10)

    const ledgers = await Ledger.find({ referenceId: createRes.body.transaction._id })
    expect(ledgers).toHaveLength(2)

    const saleLedger = ledgers.find((entry) => entry.referenceType === 'sale')
    const cogsLedger = ledgers.find((entry) => entry.referenceType === 'cogs')
    expect(String(saleLedger.debitAccountId)).toBe(String(receivableAccount._id))
    expect(Number(saleLedger.amount)).toBe(1500)
    expect(String(cogsLedger.creditAccountId)).toBe(String(inventoryAccount._id))
    expect(Number(cogsLedger.amount)).toBe(500)
  })

  test('posting purchase voucher updates vendor ledger, inventory, and balance sheet from voucher lines', async () => {
    const financeUser = await createUser({ name: 'Finance Buyer' })
    const payableAccount = await ChartOfAccount.create({
      accountName: 'Vendor Payable - Test',
      accountCode: '2101',
      accountType: 'Liability',
      createdBy: financeUser._id,
    })
    const inventoryAccount = await ChartOfAccount.create({
      accountName: 'Silver Inventory - Test',
      accountCode: '1302',
      accountType: 'Asset',
      createdBy: financeUser._id,
    })
    const vendor = await Vendor.create({
      name: 'Bullion Vendor',
      ledgerAccountId: payableAccount._id,
      createdBy: financeUser._id,
      updatedBy: financeUser._id,
    })
    const item = await InventoryItem.create({
      name: 'silver bar',
      sku: 'SILV-001',
      category: 'recordType=product',
      quantity: 20,
      unit: 'grams',
      unitCost: 30,
      ledgerAccountId: inventoryAccount._id,
      createdBy: financeUser._id,
      updatedBy: financeUser._id,
    })

    const createRes = await request(app)
      .post('/api/erp-accounting/transactions')
      .set(authHeader(financeUser))
      .send({
        type: 'purchase',
        amount: 800,
        description: 'Metal purchase voucher',
        currency: 'USD',
        vendorId: vendor._id.toString(),
        voucherMeta: {
          vocNo: '202',
          lineItems: [
            {
              stockCode: item.sku,
              productType: item.name,
              grossWeight: 5,
              amountLC: 800,
            },
          ],
        },
      })

    expect(createRes.status).toBe(201)

    const submitRes = await request(app)
      .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/submit`)
      .set(authHeader(financeUser))
      .send({ comment: 'Ready to post' })
    expect(submitRes.status).toBe(200)

    const postRes = await request(app)
      .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/post`)
      .set(authHeader(financeUser))
      .send({ comment: 'Post purchase voucher' })

    expect(postRes.status).toBe(200)
    expect(postRes.body.transaction.status).toBe('posted')

    const savedTx = await Transaction.findById(createRes.body.transaction._id)
    expect(String(savedTx.debitAccountId)).toBe(String(inventoryAccount._id))
    expect(String(savedTx.creditAccountId)).toBe(String(payableAccount._id))

    const updatedItem = await InventoryItem.findById(item._id)
    expect(Number(updatedItem.quantity)).toBe(25)
    expect(Number(updatedItem.unitCost)).toBe(56)

    const stockMovements = await StockMovement.find({ itemId: item._id })
    expect(stockMovements).toHaveLength(1)
    expect(Number(stockMovements[0].change)).toBe(5)

    const ledgers = await Ledger.find({ referenceId: createRes.body.transaction._id })
    expect(ledgers).toHaveLength(1)
    expect(ledgers[0].referenceType).toBe('purchase')
    expect(String(ledgers[0].debitAccountId)).toBe(String(inventoryAccount._id))
    expect(String(ledgers[0].creditAccountId)).toBe(String(payableAccount._id))
  })

  test('posts exchange gain for receipt and exchange loss for payment when reference rate is lower than settlement rate', async () => {
    const financeUser = await createUser({ name: 'FX Tester' })
    const receivableAccount = await ChartOfAccount.create({
      accountName: 'Customer Receivable FX',
      accountCode: '1101',
      accountType: 'Asset',
      createdBy: financeUser._id,
    })
    const customer = await Customer.create({
      name: 'FX Counterparty',
      ledgerAccountId: receivableAccount._id,
      createdBy: financeUser._id,
      updatedBy: financeUser._id,
    })

    await Currency.create({
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      exchangeRate: 1,
      baseCurrency: true,
      isActive: true,
    })

    const createAndPost = async (type) => {
      const createRes = await request(app)
        .post('/api/erp-accounting/transactions')
        .set(authHeader(financeUser))
        .send({
          type,
          amount: 100,
          description: `${type} fx check`,
          currency: 'EUR',
          exchangeRate: 1.2,
          customerId: customer._id.toString(),
          voucherMeta: {
            referenceExchangeRate: 1.0,
            lineItems: [{ type: 'cash' }],
          },
        })

      expect(createRes.status).toBe(201)

      const submitRes = await request(app)
        .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/submit`)
        .set(authHeader(financeUser))
        .send({ comment: 'Ready to post' })
      expect(submitRes.status).toBe(200)

      const postRes = await request(app)
        .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/post`)
        .set(authHeader(financeUser))
        .send({ comment: 'Post FX transaction' })
      expect(postRes.status).toBe(200)

      return createRes.body.transaction._id
    }

    const receiptTxId = await createAndPost('receipt')
    const paymentTxId = await createAndPost('payment')

    const gainAccount = await ChartOfAccount.findOne({ accountCode: '4190' })
    const lossAccount = await ChartOfAccount.findOne({ accountCode: '5190' })

    expect(gainAccount).toBeTruthy()
    expect(lossAccount).toBeTruthy()

    const receiptJournal = await Ledger.findOne({
      referenceId: receiptTxId,
      referenceType: 'journal',
      isDeleted: { $ne: true },
    })
    expect(receiptJournal).toBeTruthy()
    expect(Number(receiptJournal.amount)).toBeCloseTo(20, 2)
    expect(String(receiptJournal.creditAccountId)).toBe(String(gainAccount._id))

    const paymentJournal = await Ledger.findOne({
      referenceId: paymentTxId,
      referenceType: 'journal',
      isDeleted: { $ne: true },
    })
    expect(paymentJournal).toBeTruthy()
    expect(Number(paymentJournal.amount)).toBeCloseTo(20, 2)
    expect(String(paymentJournal.debitAccountId)).toBe(String(lossAccount._id))
  })

  test('does not post exchange journal when reference rate is missing or zero', async () => {
    const financeUser = await createUser({ name: 'FX Guard Tester' })
    const receivableAccount = await ChartOfAccount.create({
      accountName: 'Customer Receivable FX Guard',
      accountCode: '1102',
      accountType: 'Asset',
      createdBy: financeUser._id,
    })
    const customer = await Customer.create({
      name: 'FX Guard Counterparty',
      ledgerAccountId: receivableAccount._id,
      createdBy: financeUser._id,
      updatedBy: financeUser._id,
    })

    await Currency.create({
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      exchangeRate: 1,
      baseCurrency: true,
      isActive: true,
    })

    const createAndPost = async (voucherMeta) => {
      const createRes = await request(app)
        .post('/api/erp-accounting/transactions')
        .set(authHeader(financeUser))
        .send({
          type: 'receipt',
          amount: 100,
          description: 'receipt fx guard',
          currency: 'EUR',
          exchangeRate: 1.2,
          customerId: customer._id.toString(),
          voucherMeta,
        })

      expect(createRes.status).toBe(201)

      const submitRes = await request(app)
        .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/submit`)
        .set(authHeader(financeUser))
        .send({ comment: 'Ready to post' })
      expect(submitRes.status).toBe(200)

      const postRes = await request(app)
        .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/post`)
        .set(authHeader(financeUser))
        .send({ comment: 'Post FX guard transaction' })
      expect(postRes.status).toBe(200)

      return createRes.body.transaction._id
    }

    const missingRateTxId = await createAndPost({ lineItems: [{ type: 'cash' }] })
    const zeroRateTxId = await createAndPost({ referenceExchangeRate: 0, lineItems: [{ type: 'cash' }] })

    const missingRateJournal = await Ledger.findOne({
      referenceId: missingRateTxId,
      referenceType: 'journal',
      isDeleted: { $ne: true },
    })
    const zeroRateJournal = await Ledger.findOne({
      referenceId: zeroRateTxId,
      referenceType: 'journal',
      isDeleted: { $ne: true },
    })

    expect(missingRateJournal).toBeNull()
    expect(zeroRateJournal).toBeNull()
  })

  test('posts exchange journal when line item referenceRate is present without voucher-level reference rate', async () => {
    const financeUser = await createUser({ name: 'FX Line Item Tester' })
    const receivableAccount = await ChartOfAccount.create({
      accountName: 'Customer Receivable FX Line Item',
      accountCode: '1103',
      accountType: 'Asset',
      createdBy: financeUser._id,
    })
    const customer = await Customer.create({
      name: 'FX Line Item Counterparty',
      ledgerAccountId: receivableAccount._id,
      createdBy: financeUser._id,
      updatedBy: financeUser._id,
    })

    await Currency.create({
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      exchangeRate: 1,
      baseCurrency: true,
      isActive: true,
    })

    const createRes = await request(app)
      .post('/api/erp-accounting/transactions')
      .set(authHeader(financeUser))
      .send({
        type: 'receipt',
        amount: 100,
        description: 'receipt fx line item reference rate',
        currency: 'EUR',
        exchangeRate: 1.2,
        customerId: customer._id.toString(),
        voucherMeta: {
          lineItems: [{ type: 'cash', referenceRate: 1.0 }],
        },
      })

    expect(createRes.status).toBe(201)

    const submitRes = await request(app)
      .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/submit`)
      .set(authHeader(financeUser))
      .send({ comment: 'Ready to post' })
    expect(submitRes.status).toBe(200)

    const postRes = await request(app)
      .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/post`)
      .set(authHeader(financeUser))
      .send({ comment: 'Post FX line item transaction' })
    expect(postRes.status).toBe(200)

    const gainAccount = await ChartOfAccount.findOne({ accountCode: '4190' })
    expect(gainAccount).toBeTruthy()

    const fxJournal = await Ledger.findOne({
      referenceId: createRes.body.transaction._id,
      referenceType: 'journal',
      isDeleted: { $ne: true },
    })

    expect(fxJournal).toBeTruthy()
    expect(Number(fxJournal.amount)).toBeCloseTo(20, 2)
    expect(String(fxJournal.creditAccountId)).toBe(String(gainAccount._id))
  })
})