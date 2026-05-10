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
const { runWithTenantConnection } = require('../db/tenantModelProxy')
const { registerAllOnConnection } = require('../db/tenantModelRegistry')
const { connectTenant } = require('../db/tenantConnections')
const { applyPartyAccountPriority } = require('../utils/transactionPartyAccounts')

jest.setTimeout(120000)

let mongo
let app
let mongoConnection

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

const createOpsUser = async (overrides = {}) => {
  const now = Date.now().toString(36)
  return User.create({
    name: `ops-${now}-${Math.random().toString(36).slice(2, 8)}`,
    email: `ops-${now}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: 'password123',
    role: 'department_head',
    department: 'operations',
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

const queryInTenant = async (queryFactory) => {
  const connection = await connectTenant(TEST_TENANT)
  registerAllOnConnection(connection)
  return runWithTenantConnection(connection, TEST_TENANT, queryFactory)
}

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
  process.env.MONGO_URI_MG = mongoUri
  process.env.MONGO_URI_CG = mongoUri
  
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 60000,
    maxPoolSize: 1,
  })
  mongoConnection = await mongoose.connection
  
  // For tests, use the default mongoose connection for all tenant models
  const registry = require('../db/tenantModelRegistry')
  registry.registerAllOnConnection(mongoConnection)
  
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

    const approveRes = await request(app)
      .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/approve`)
      .set(authHeader(financeUser))
      .send({ comment: 'Approved for posting' })
    expect(approveRes.status).toBe(200)

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

    const approveRes = await request(app)
      .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/approve`)
      .set(authHeader(financeUser))
      .send({ comment: 'Approved for posting' })
    expect(approveRes.status).toBe(200)

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

  test('supports direct chart account party selection through save, approve, and post for all four voucher types', async () => {
    const financeUser = await createUser({ name: 'Direct Party Account Tester' })

    await Currency.create({
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      exchangeRate: 1,
      baseCurrency: true,
      isActive: true,
    })

    const receiptPartyAccount = await ChartOfAccount.create({
      accountName: 'Direct Receipt Party',
      accountCode: '1108',
      accountType: 'Asset',
      createdBy: financeUser._id,
    })
    const paymentPartyAccount = await ChartOfAccount.create({
      accountName: 'Direct Payment Party',
      accountCode: '2108',
      accountType: 'Liability',
      createdBy: financeUser._id,
    })
    const salePartyAccount = await ChartOfAccount.create({
      accountName: 'Direct Sale Party',
      accountCode: '1118',
      accountType: 'Asset',
      createdBy: financeUser._id,
    })
    const purchasePartyAccount = await ChartOfAccount.create({
      accountName: 'Direct Purchase Party',
      accountCode: '2118',
      accountType: 'Liability',
      createdBy: financeUser._id,
    })
    const saleInventoryAccount = await ChartOfAccount.create({
      accountName: 'Direct Sale Inventory',
      accountCode: '1318',
      accountType: 'Asset',
      createdBy: financeUser._id,
    })
    const purchaseInventoryAccount = await ChartOfAccount.create({
      accountName: 'Direct Purchase Inventory',
      accountCode: '1319',
      accountType: 'Asset',
      createdBy: financeUser._id,
    })

    const saleItem = await InventoryItem.create({
      name: 'direct sale item',
      sku: 'DIR-SALE-001',
      category: 'recordType=product',
      quantity: 25,
      unit: 'grams',
      unitCost: 40,
      ledgerAccountId: saleInventoryAccount._id,
      createdBy: financeUser._id,
      updatedBy: financeUser._id,
    })
    const purchaseItem = await InventoryItem.create({
      name: 'direct purchase item',
      sku: 'DIR-PUR-001',
      category: 'recordType=product',
      quantity: 10,
      unit: 'grams',
      unitCost: 25,
      ledgerAccountId: purchaseInventoryAccount._id,
      createdBy: financeUser._id,
      updatedBy: financeUser._id,
    })

    const createApproveAndPost = async (payload) => {
      const createRes = await request(app)
        .post('/api/erp-accounting/transactions')
        .set(authHeader(financeUser))
        .send(payload)

      expect(createRes.status).toBe(201)

      const txId = createRes.body.transaction._id

      const submitRes = await request(app)
        .post(`/api/erp-accounting/transactions/${txId}/submit`)
        .set(authHeader(financeUser))
        .send({ comment: 'Submit direct account voucher' })
      expect(submitRes.status).toBe(200)

      const approveRes = await request(app)
        .post(`/api/erp-accounting/transactions/${txId}/approve`)
        .set(authHeader(financeUser))
        .send({ comment: 'Approve direct account voucher' })
      expect(approveRes.status).toBe(200)

      let postRes = await request(app)
        .post(`/api/erp-accounting/transactions/${txId}/post`)
        .set(authHeader(financeUser))
        .send({ comment: 'Post direct account voucher' })

      if (postRes.status === 409 && postRes.body?.code === 'VENDOR_ADVANCE_CONFIRMATION_REQUIRED') {
        postRes = await request(app)
          .post(`/api/erp-accounting/transactions/${txId}/post`)
          .set(authHeader(financeUser))
          .send({ comment: 'Post direct account voucher', confirmVendorAdvance: true })
      }

      expect(postRes.status).toBe(200)

      return txId
    }

    const receiptTxId = await createApproveAndPost({
      type: 'receipt',
      amount: 200,
      description: 'Receipt with direct party account',
      currency: 'USD',
      voucherMeta: {
        partyCode: receiptPartyAccount.accountCode,
        partyName: receiptPartyAccount.accountName,
        partyAccountId: receiptPartyAccount._id.toString(),
        lineItems: [{ type: 'cash' }],
      },
    })

    const paymentTxId = await createApproveAndPost({
      type: 'payment',
      amount: 180,
      description: 'Payment with direct party account',
      currency: 'USD',
      voucherMeta: {
        partyCode: paymentPartyAccount.accountCode,
        partyName: paymentPartyAccount.accountName,
        partyAccountId: paymentPartyAccount._id.toString(),
        lineItems: [{ type: 'cash' }],
      },
    })

    const saleTxId = await createApproveAndPost({
      type: 'sale',
      amount: 900,
      description: 'Sale with direct party account',
      currency: 'USD',
      voucherMeta: {
        partyCode: salePartyAccount.accountCode,
        partyName: salePartyAccount.accountName,
        partyAccountId: salePartyAccount._id.toString(),
        lineItems: [
          {
            stockCode: saleItem.sku,
            productType: saleItem.name,
            grossWeight: 5,
            amountLC: 900,
          },
        ],
      },
    })

    const purchaseTxId = await createApproveAndPost({
      type: 'purchase',
      amount: 300,
      description: 'Purchase with direct party account',
      currency: 'USD',
      voucherMeta: {
        partyCode: purchasePartyAccount.accountCode,
        partyName: purchasePartyAccount.accountName,
        partyAccountId: purchasePartyAccount._id.toString(),
        lineItems: [
          {
            stockCode: purchaseItem.sku,
            productType: purchaseItem.name,
            grossWeight: 2,
            amountLC: 300,
          },
        ],
      },
    })

    const receiptTx = await Transaction.findById(receiptTxId)
    const paymentTx = await Transaction.findById(paymentTxId)
    const saleTx = await Transaction.findById(saleTxId)
    const purchaseTx = await Transaction.findById(purchaseTxId)

    expect(String(receiptTx.creditAccountId)).toBe(String(receiptPartyAccount._id))
    expect(String(paymentTx.debitAccountId)).toBe(String(paymentPartyAccount._id))
    expect(String(saleTx.debitAccountId)).toBe(String(salePartyAccount._id))
    expect(String(purchaseTx.creditAccountId)).toBe(String(purchasePartyAccount._id))
  })

  test('applies party account priority through the posted voucher path for receipt and payment vouchers', async () => {
    const financeUser = await createUser({ name: 'Party Priority Tester' })

    await Currency.create({
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      exchangeRate: 1,
      baseCurrency: true,
      isActive: true,
    })

    const receiptPartyAccount = await ChartOfAccount.create({
      accountName: 'Priority Receipt Party',
      accountCode: '1128',
      accountType: 'Asset',
      createdBy: financeUser._id,
    })
    const paymentPartyAccount = await ChartOfAccount.create({
      accountName: 'Priority Payment Party',
      accountCode: '2128',
      accountType: 'Liability',
      createdBy: financeUser._id,
    })
    const bankAccount = await ChartOfAccount.create({
      accountName: 'Priority Bank',
      accountCode: '1008',
      accountType: 'Asset',
      createdBy: financeUser._id,
    })

    const postVoucher = async (type, partyAccount) => {
      const createRes = await request(app)
        .post('/api/erp-accounting/transactions')
        .set(authHeader(financeUser))
        .send({
          type,
          amount: 125,
          description: `${type} party priority test`,
          currency: 'USD',
          voucherMeta: {
            partyCode: partyAccount.accountCode,
            partyName: partyAccount.accountName,
            partyAccountId: partyAccount._id.toString(),
            lineItems: [{ type: 'cash' }],
          },
        })

      expect(createRes.status).toBe(201)

      const txId = createRes.body.transaction._id
      await request(app)
        .post(`/api/erp-accounting/transactions/${txId}/submit`)
        .set(authHeader(financeUser))
        .send({ comment: 'Submit party priority voucher' })
      await request(app)
        .post(`/api/erp-accounting/transactions/${txId}/approve`)
        .set(authHeader(financeUser))
        .send({ comment: 'Approve party priority voucher' })
      let postRes = await request(app)
        .post(`/api/erp-accounting/transactions/${txId}/post`)
        .set(authHeader(financeUser))
        .send({ comment: 'Post party priority voucher' })

      if (postRes.status === 409 && postRes.body?.code === 'VENDOR_ADVANCE_CONFIRMATION_REQUIRED') {
        postRes = await request(app)
          .post(`/api/erp-accounting/transactions/${txId}/post`)
          .set(authHeader(financeUser))
          .send({ comment: 'Post party priority voucher', confirmVendorAdvance: true })
      }

      expect(postRes.status).toBe(200)
      return Transaction.findById(txId)
    }

    const receiptTx = await postVoucher('receipt', receiptPartyAccount)
    const paymentTx = await postVoucher('payment', paymentPartyAccount)

    expect(applyPartyAccountPriority({
      transactionType: 'receipt',
      debitAccountId: bankAccount._id.toString(),
      creditAccountId: null,
      directPartyAccountId: receiptPartyAccount._id.toString(),
    })).toEqual({
      debitAccountId: bankAccount._id.toString(),
      creditAccountId: receiptPartyAccount._id.toString(),
    })

    expect(applyPartyAccountPriority({
      transactionType: 'payment',
      debitAccountId: null,
      creditAccountId: bankAccount._id.toString(),
      directPartyAccountId: paymentPartyAccount._id.toString(),
    })).toEqual({
      debitAccountId: paymentPartyAccount._id.toString(),
      creditAccountId: bankAccount._id.toString(),
    })

    expect(String(receiptTx.creditAccountId)).toBe(String(receiptPartyAccount._id))
    expect(String(paymentTx.debitAccountId)).toBe(String(paymentPartyAccount._id))
  })

  test('requires confirmation before posting a payment voucher that would create a vendor advance', async () => {
    const financeUser = await createUser({ name: 'Vendor Advance Warning Tester' })

    await Currency.create({
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      exchangeRate: 1,
      baseCurrency: true,
      isActive: true,
    })

    const vendorPayableAccount = await ChartOfAccount.create({
      accountName: 'Advance Warning Vendor',
      accountCode: '2408',
      accountType: 'Liability',
      createdBy: financeUser._id,
    })

    const vendor = await Vendor.create({
      name: 'Advance Warning Vendor',
      vendorCode: 'VEN-2408',
      ledgerAccountId: vendorPayableAccount._id,
      createdBy: financeUser._id,
      updatedBy: financeUser._id,
    })

    const createRes = await request(app)
      .post('/api/erp-accounting/transactions')
      .set(authHeader(financeUser))
      .send({
        type: 'payment',
        amount: 300,
        description: 'Payment that creates vendor advance',
        currency: 'USD',
        vendorId: vendor._id.toString(),
        voucherMeta: {
          partyCode: vendorPayableAccount.accountCode,
          partyName: vendorPayableAccount.accountName,
          partyAccountId: vendorPayableAccount._id.toString(),
          lineItems: [{ type: 'cash' }],
        },
      })

    expect(createRes.status).toBe(201)
    const txId = createRes.body.transaction._id

    await request(app)
      .post(`/api/erp-accounting/transactions/${txId}/submit`)
      .set(authHeader(financeUser))
      .send({ comment: 'Submit advance warning voucher' })

    await request(app)
      .post(`/api/erp-accounting/transactions/${txId}/approve`)
      .set(authHeader(financeUser))
      .send({ comment: 'Approve advance warning voucher' })

    const warningRes = await request(app)
      .post(`/api/erp-accounting/transactions/${txId}/post`)
      .set(authHeader(financeUser))
      .send({ comment: 'Post advance warning voucher' })

    expect(warningRes.status).toBe(409)
    expect(warningRes.body.code).toBe('VENDOR_ADVANCE_CONFIRMATION_REQUIRED')
    expect(String(warningRes.body.message || '')).toMatch(/vendor advance/i)
    expect(Number(warningRes.body.details?.paymentAmount || 0)).toBeCloseTo(300, 2)

    const confirmRes = await request(app)
      .post(`/api/erp-accounting/transactions/${txId}/post`)
      .set(authHeader(financeUser))
      .send({ comment: 'Confirm vendor advance', confirmVendorAdvance: true })

    expect(confirmRes.status).toBe(200)

    const postedTx = await Transaction.findById(txId)
    expect(postedTx.status).toBe('posted')
    expect(String(postedTx.debitAccountId)).toBe(String(vendorPayableAccount._id))
  })

  test('auto-posts VAT split journals for sale and purchase vouchers from voucher line VAT amounts', async () => {
    const financeUser = await createUser({ name: 'VAT Poster' })

    const receivableAccount = await ChartOfAccount.create({
      accountName: 'Customer Receivable VAT',
      accountCode: '1203',
      accountType: 'Asset',
      createdBy: financeUser._id,
    })
    const payableAccount = await ChartOfAccount.create({
      accountName: 'Vendor Payable VAT',
      accountCode: '2103',
      accountType: 'Liability',
      createdBy: financeUser._id,
    })

    const customer = await Customer.create({
      name: 'VAT Sale Customer',
      ledgerAccountId: receivableAccount._id,
      createdBy: financeUser._id,
      updatedBy: financeUser._id,
    })
    const vendor = await Vendor.create({
      name: 'VAT Purchase Vendor',
      ledgerAccountId: payableAccount._id,
      createdBy: financeUser._id,
      updatedBy: financeUser._id,
    })

    const saleCreate = await request(app)
      .post('/api/erp-accounting/transactions')
      .set(authHeader(financeUser))
      .send({
        type: 'sale',
        amount: 1000,
        description: 'Sale with VAT',
        currency: 'USD',
        customerId: customer._id.toString(),
        voucherMeta: {
          lineItems: [
            {
              amountLC: 1000,
              vatAmountLC: 50,
            },
          ],
        },
      })
    expect(saleCreate.status).toBe(201)

    await request(app)
      .post(`/api/erp-accounting/transactions/${saleCreate.body.transaction._id}/submit`)
      .set(authHeader(financeUser))
      .send({ comment: 'Submit sale VAT voucher' })
    await request(app)
      .post(`/api/erp-accounting/transactions/${saleCreate.body.transaction._id}/approve`)
      .set(authHeader(financeUser))
      .send({ comment: 'Approve sale VAT voucher' })
    const salePost = await request(app)
      .post(`/api/erp-accounting/transactions/${saleCreate.body.transaction._id}/post`)
      .set(authHeader(financeUser))
      .send({ comment: 'Post sale VAT voucher' })
    expect(salePost.status).toBe(200)

    const purchaseCreate = await request(app)
      .post('/api/erp-accounting/transactions')
      .set(authHeader(financeUser))
      .send({
        type: 'purchase',
        amount: 700,
        description: 'Purchase with VAT',
        currency: 'USD',
        vendorId: vendor._id.toString(),
        voucherMeta: {
          lineItems: [
            {
              amountLC: 700,
              vatAmountLC: 35,
            },
          ],
        },
      })
    expect(purchaseCreate.status).toBe(201)

    await request(app)
      .post(`/api/erp-accounting/transactions/${purchaseCreate.body.transaction._id}/submit`)
      .set(authHeader(financeUser))
      .send({ comment: 'Submit purchase VAT voucher' })
    await request(app)
      .post(`/api/erp-accounting/transactions/${purchaseCreate.body.transaction._id}/approve`)
      .set(authHeader(financeUser))
      .send({ comment: 'Approve purchase VAT voucher' })
    const purchasePost = await request(app)
      .post(`/api/erp-accounting/transactions/${purchaseCreate.body.transaction._id}/post`)
      .set(authHeader(financeUser))
      .send({ comment: 'Post purchase VAT voucher' })
    expect(purchasePost.status).toBe(200)

    const vatPayableAccount = await ChartOfAccount.findOne({ accountCode: '2190' })
    const vatReceivableAccount = await ChartOfAccount.findOne({ accountCode: '1190' })
    expect(vatPayableAccount).toBeTruthy()
    expect(vatReceivableAccount).toBeTruthy()

    const saleVatLedger = await Ledger.findOne({
      referenceId: saleCreate.body.transaction._id,
      referenceType: 'vat_output',
      isDeleted: { $ne: true },
    })
    expect(saleVatLedger).toBeTruthy()
    expect(Number(saleVatLedger.amount)).toBeCloseTo(50, 2)
    expect(String(saleVatLedger.debitAccountId)).toBe(String(receivableAccount._id))
    expect(String(saleVatLedger.creditAccountId)).toBe(String(vatPayableAccount._id))

    const purchaseVatLedger = await Ledger.findOne({
      referenceId: purchaseCreate.body.transaction._id,
      referenceType: 'vat_input',
      isDeleted: { $ne: true },
    })
    expect(purchaseVatLedger).toBeTruthy()
    expect(Number(purchaseVatLedger.amount)).toBeCloseTo(35, 2)
    expect(String(purchaseVatLedger.debitAccountId)).toBe(String(vatReceivableAccount._id))
    expect(String(purchaseVatLedger.creditAccountId)).toBe(String(payableAccount._id))
  })

  test('posts exchange loss for receipt and exchange gain for payment when reference rate is lower than settlement rate', async () => {
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
            lineItems: [{ type: 'cash', currCode: 'EUR', currRate: 1.2 }],
          },
        })

      expect(createRes.status).toBe(201)

      const submitRes = await request(app)
        .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/submit`)
        .set(authHeader(financeUser))
        .send({ comment: 'Ready to post' })
      expect(submitRes.status).toBe(200)

      const approveRes = await request(app)
        .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/approve`)
        .set(authHeader(financeUser))
        .send({ comment: 'Approve FX transaction' })
      expect(approveRes.status).toBe(200)

      const postRes = await request(app)
        .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/post`)
        .set(authHeader(financeUser))
        .send({ comment: 'Post FX transaction' })
      expect(postRes.status).toBe(200)

      return createRes.body.transaction._id
    }

    const receiptTxId = await createAndPost('receipt')
    const paymentTxId = await createAndPost('payment')

    const receiptJournal = await queryInTenant(() => Ledger.findOne({
      referenceId: receiptTxId,
      referenceType: 'journal',
      isDeleted: { $ne: true },
    }))
    expect(receiptJournal).toBeTruthy()
    expect(Number(receiptJournal.amount)).toBeCloseTo(16.67, 2)

    const receiptDebitAccount = await queryInTenant(() => ChartOfAccount.findById(receiptJournal.debitAccountId))
    expect(receiptDebitAccount).toBeTruthy()
    expect(receiptDebitAccount.accountType).toBe('Expense')

    const paymentJournal = await queryInTenant(() => Ledger.findOne({
      referenceId: paymentTxId,
      referenceType: 'journal',
      isDeleted: { $ne: true },
    }))
    expect(paymentJournal).toBeTruthy()
    expect(Number(paymentJournal.amount)).toBeCloseTo(16.67, 2)

    const paymentCreditAccount = await queryInTenant(() => ChartOfAccount.findById(paymentJournal.creditAccountId))
    expect(paymentCreditAccount).toBeTruthy()
    expect(paymentCreditAccount.accountType).toBe('Income')
  })

  test('does not post FX journal for multi-line receipt/payment when aggregated foreign amounts match reference rate', async () => {
    const financeUser = await createUser({ name: 'FX Multi Line Tester' })
    const receivableAccount = await ChartOfAccount.create({
      accountName: 'Customer Receivable FX Multi Line',
      accountCode: '1104',
      accountType: 'Asset',
      createdBy: financeUser._id,
    })
    const customer = await Customer.create({
      name: 'FX Multi Line Counterparty',
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
          amount: 240,
          description: `${type} fx multi-line check`,
          currency: 'EUR',
          exchangeRate: 1.2,
          customerId: customer._id.toString(),
          voucherMeta: {
            referenceExchangeRate: 1.2,
            lineItems: [
              { type: 'cash', currCode: 'EUR', currRate: 1.2, amountFC: 100 },
              { type: 'cash', currCode: 'EUR', currRate: 1.2, amountFC: 100 },
            ],
          },
        })

      expect(createRes.status).toBe(201)

      const submitRes = await request(app)
        .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/submit`)
        .set(authHeader(financeUser))
        .send({ comment: 'Ready to post' })
      expect(submitRes.status).toBe(200)

      const approveRes = await request(app)
        .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/approve`)
        .set(authHeader(financeUser))
        .send({ comment: 'Approve FX multi-line transaction' })
      expect(approveRes.status).toBe(200)

      const postRes = await request(app)
        .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/post`)
        .set(authHeader(financeUser))
        .send({ comment: 'Post FX multi-line transaction' })
      expect(postRes.status).toBe(200)

      return createRes.body.transaction._id
    }

    const receiptTxId = await createAndPost('receipt')
    const paymentTxId = await createAndPost('payment')

    const receiptJournal = await queryInTenant(() => Ledger.findOne({
      referenceId: receiptTxId,
      referenceType: 'journal',
      isDeleted: { $ne: true },
    }))
    expect(receiptJournal).toBeFalsy()

    const paymentJournal = await queryInTenant(() => Ledger.findOne({
      referenceId: paymentTxId,
      referenceType: 'journal',
      isDeleted: { $ne: true },
    }))
    expect(paymentJournal).toBeFalsy()
  })

  test('does not post FX journal for rounded multi-line payment totals when FC and line rates match reference rate', async () => {
    const financeUser = await createUser({ name: 'FX Rounded Multi Line Tester' })
    const payableAccount = await ChartOfAccount.create({
      accountName: 'Vendor Payable FX Rounded Multi Line',
      accountCode: '2104',
      accountType: 'Liability',
      createdBy: financeUser._id,
    })
    const vendor = await Vendor.create({
      name: 'FX Rounded Multi Line Vendor',
      ledgerAccountId: payableAccount._id,
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

    const referenceRate = 0.00008264462809917356 // 1 / 12100
    const createRes = await request(app)
      .post('/api/erp-accounting/transactions')
      .set(authHeader(financeUser))
      .send({
        type: 'payment',
        amount: 16.52,
        description: 'payment fx rounded multi-line check',
        currency: 'UZS',
        exchangeRate: referenceRate,
        vendorId: vendor._id.toString(),
        voucherMeta: {
          referenceExchangeRate: referenceRate,
          lineItems: [
            { type: 'cash', currCode: 'UZS', currRate: referenceRate, amountFC: 100000, amountLC: 8.26 },
            { type: 'cash', currCode: 'UZS', currRate: referenceRate, amountFC: 100000, amountLC: 8.26 },
          ],
        },
      })

    expect(createRes.status).toBe(201)

    const submitRes = await request(app)
      .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/submit`)
      .set(authHeader(financeUser))
      .send({ comment: 'Ready to post rounded FX multi-line transaction' })
    expect(submitRes.status).toBe(200)

    const approveRes = await request(app)
      .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/approve`)
      .set(authHeader(financeUser))
      .send({ comment: 'Approve rounded FX multi-line transaction' })
    expect(approveRes.status).toBe(200)

    const initialPostRes = await request(app)
      .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/post`)
      .set(authHeader(financeUser))
      .send({ comment: 'Post rounded FX multi-line transaction' })
    const postRes = initialPostRes.status === 409
      ? await request(app)
        .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/post`)
        .set(authHeader(financeUser))
        .send({
          comment: 'Post rounded FX multi-line transaction',
          confirmVendorAdvance: true,
        })
      : initialPostRes
    expect(postRes.status).toBe(200)

    const paymentJournal = await queryInTenant(() => Ledger.findOne({
      referenceId: createRes.body.transaction._id,
      referenceType: 'journal',
      isDeleted: { $ne: true },
    }))
    expect(paymentJournal).toBeFalsy()
  })

  test('revalue-fx-journal removes stale tiny FX rows when corrected difference is below epsilon', async () => {
    const financeUser = await createUser({ name: 'FX Revalue Tiny Row Tester', role: 'super_admin' })

    const payableAccount = await ChartOfAccount.create({
      accountName: 'Vendor Payable FX Revalue Tiny',
      accountCode: '2105',
      accountType: 'Liability',
      createdBy: financeUser._id,
    })
    const bankAccount = await ChartOfAccount.create({
      accountName: 'Bank FX Revalue Tiny',
      accountCode: '1019',
      accountType: 'Asset',
      createdBy: financeUser._id,
    })
    const fxLossAccount = await ChartOfAccount.create({
      accountName: 'Exchange Loss FX Revalue Tiny',
      accountCode: '5199',
      accountType: 'Expense',
      createdBy: financeUser._id,
    })

    await Vendor.create({
      name: 'FX Revalue Tiny Vendor',
      ledgerAccountId: payableAccount._id,
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

    const referenceRate = 1 / 12100
    const createRes = await request(app)
      .post('/api/erp-accounting/transactions')
      .set(authHeader(financeUser))
      .send({
        type: 'payment',
        amount: 16.52,
        description: 'payment fx revalue tiny row check',
        currency: 'UZS',
        exchangeRate: referenceRate,
        voucherMeta: {
          referenceExchangeRate: referenceRate,
          partyCode: '2105',
          lineItems: [
            { type: 'cash', currCode: 'UZS', currRate: referenceRate, amountFC: 100000, amountLC: 8.26 },
            { type: 'cash', currCode: 'UZS', currRate: referenceRate, amountFC: 100000, amountLC: 8.26 },
          ],
        },
      })
    expect(createRes.status).toBe(201)

    const txId = createRes.body.transaction._id

    await request(app)
      .post(`/api/erp-accounting/transactions/${txId}/submit`)
      .set(authHeader(financeUser))
      .send({ comment: 'Ready to post FX revalue tiny row tx' })
      .expect(200)

    await request(app)
      .post(`/api/erp-accounting/transactions/${txId}/approve`)
      .set(authHeader(financeUser))
      .send({ comment: 'Approve FX revalue tiny row tx' })
      .expect(200)

    const firstPost = await request(app)
      .post(`/api/erp-accounting/transactions/${txId}/post`)
      .set(authHeader(financeUser))
      .send({ comment: 'Post FX revalue tiny row tx' })

    if (firstPost.status === 409) {
      await request(app)
        .post(`/api/erp-accounting/transactions/${txId}/post`)
        .set(authHeader(financeUser))
        .send({ comment: 'Post FX revalue tiny row tx', confirmVendorAdvance: true })
        .expect(200)
    } else {
      expect(firstPost.status).toBe(200)
    }

    const staleJournal = await queryInTenant(() => Ledger.create({
      date: new Date(),
      debitAccountId: fxLossAccount._id,
      creditAccountId: bankAccount._id,
      amount: 0.01,
      description: `Exchange loss adjustment for transaction ${txId}`,
      referenceType: 'journal',
      referenceId: txId,
      currency: 'USD',
      exchangeRate: 1,
      createdBy: financeUser._id,
      updatedBy: financeUser._id,
      department: financeUser.department,
    }))

    const revalueRes = await request(app)
      .post(`/api/erp-accounting/transactions/${txId}/revalue-fx-journal`)
      .set(authHeader(financeUser))
      .send({ apply: true })

    expect(revalueRes.status).toBe(200)
    expect(revalueRes.body.counts.removedCount).toBe(1)

    const reloaded = await queryInTenant(() => Ledger.findById(staleJournal._id))
    expect(reloaded).toBeTruthy()
    expect(reloaded.isDeleted).toBe(true)
  })

  test('rejects non-base receipt when reference rate is missing or zero', async () => {
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

    const missingRateRes = await request(app)
      .post('/api/erp-accounting/transactions')
      .set(authHeader(financeUser))
      .send({
        type: 'receipt',
        amount: 100,
        description: 'receipt fx guard missing rate',
        currency: 'EUR',
        exchangeRate: 1.2,
        customerId: customer._id.toString(),
        voucherMeta: { lineItems: [{ type: 'cash' }] },
      })

    expect(missingRateRes.status).toBe(400)
    expect(String(missingRateRes.body?.message || '')).toMatch(/Reference exchange rate is required/i)

    const zeroRateRes = await request(app)
      .post('/api/erp-accounting/transactions')
      .set(authHeader(financeUser))
      .send({
        type: 'receipt',
        amount: 100,
        description: 'receipt fx guard zero rate',
        currency: 'EUR',
        exchangeRate: 1.2,
        customerId: customer._id.toString(),
        voucherMeta: { referenceExchangeRate: 0, lineItems: [{ type: 'cash' }] },
      })

    expect(zeroRateRes.status).toBe(400)
    expect(String(zeroRateRes.body?.message || '')).toMatch(/Reference exchange rate is required/i)
  })

  test('posts exchange loss journal when line item referenceRate is present without voucher-level reference rate', async () => {
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
          lineItems: [{ type: 'cash', referenceRate: 1.0, currCode: 'EUR', currRate: 1.2 }],
        },
      })

    expect(createRes.status).toBe(201)

    const submitRes = await request(app)
      .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/submit`)
      .set(authHeader(financeUser))
      .send({ comment: 'Ready to post' })
    expect(submitRes.status).toBe(200)

    const approveRes = await request(app)
      .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/approve`)
      .set(authHeader(financeUser))
      .send({ comment: 'Approve FX line item transaction' })
    expect(approveRes.status).toBe(200)

    const postRes = await request(app)
      .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/post`)
      .set(authHeader(financeUser))
      .send({ comment: 'Post FX line item transaction' })
    expect(postRes.status).toBe(200)

    const fxJournal = await queryInTenant(() => Ledger.findOne({
      referenceId: createRes.body.transaction._id,
      referenceType: 'journal',
      isDeleted: { $ne: true },
    }))

    expect(fxJournal).toBeTruthy()
    expect(Number(fxJournal.amount)).toBeCloseTo(16.67, 2)

    const fxDebitAccount = await queryInTenant(() => ChartOfAccount.findById(fxJournal.debitAccountId))
    expect(fxDebitAccount).toBeTruthy()
    expect(fxDebitAccount.accountType).toBe('Expense')
  })

  test('non-finance user cannot void or delete transaction', async () => {
    const financeUser = await createUser({ name: 'Finance Owner' })
    const opsUser = await createOpsUser({ name: 'Ops Reviewer' })

    const createRes = await request(app)
      .post('/api/erp-accounting/transactions')
      .set(authHeader(financeUser))
      .send({
        type: 'expense',
        amount: 250,
        description: 'Ops should not void/delete this',
        currency: 'USD',
      })

    expect(createRes.status).toBe(201)
    const txId = createRes.body.transaction._id

    const voidRes = await request(app)
      .post(`/api/erp-accounting/transactions/${txId}/void`)
      .set(authHeader(opsUser))
      .send({ reason: 'Trying unauthorized void' })

    expect(voidRes.status).toBe(403)

    const deleteRes = await request(app)
      .delete(`/api/erp-accounting/transactions/${txId}`)
      .set(authHeader(opsUser))

    expect(deleteRes.status).toBe(403)
  })

  test('role-restricted user cannot submit disallowed transaction type', async () => {
    const financeUser = await createUser({ name: 'Finance Creator' })
    const managementUser = await createUser({
      name: 'Management Submitter',
      role: 'management',
      department: 'management',
    })

    const createRes = await request(app)
      .post('/api/erp-accounting/transactions')
      .set(authHeader(financeUser))
      .send({
        type: 'expense',
        amount: 400,
        description: 'Finance draft transaction',
        currency: 'USD',
      })

    expect(createRes.status).toBe(201)

    const submitRes = await request(app)
      .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/submit`)
      .set(authHeader(managementUser))
      .send({ comment: 'Attempt unauthorized submit' })

    expect(submitRes.status).toBe(403)
  })

  test('post requires approved status and rejects submitted transaction', async () => {
    const financeUser = await createUser({ name: 'Finance Approver' })

    const createRes = await request(app)
      .post('/api/erp-accounting/transactions')
      .set(authHeader(financeUser))
      .send({
        type: 'expense',
        amount: 300,
        description: 'Submitted-only should fail post',
        currency: 'USD',
      })

    expect(createRes.status).toBe(201)

    const submitRes = await request(app)
      .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/submit`)
      .set(authHeader(financeUser))
      .send({ comment: 'submit first' })

    expect(submitRes.status).toBe(200)

    const postRes = await request(app)
      .post(`/api/erp-accounting/transactions/${createRes.body.transaction._id}/post`)
      .set(authHeader(financeUser))
      .send({ comment: 'attempt posting while submitted' })

    expect(postRes.status).toBe(400)
  })

  test('rejects invalid numeric values on transaction create', async () => {
    const financeUser = await createUser({ name: 'Numeric Guard' })

    const badRateRes = await request(app)
      .post('/api/erp-accounting/transactions')
      .set(authHeader(financeUser))
      .send({
        type: 'expense',
        amount: 100,
        exchangeRate: 0,
        description: 'invalid exchange rate',
      })

    expect(badRateRes.status).toBe(400)
    expect(badRateRes.body.message).toMatch(/exchangeRate/i)

    const badAmountRes = await request(app)
      .post('/api/erp-accounting/transactions')
      .set(authHeader(financeUser))
      .send({
        type: 'expense',
        amount: 'not-a-number',
        description: 'invalid amount',
      })

    expect(badAmountRes.status).toBe(400)
    expect(badAmountRes.body.message).toMatch(/amount/i)
  })
})
