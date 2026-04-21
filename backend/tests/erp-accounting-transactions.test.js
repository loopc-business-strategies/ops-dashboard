const fs = require('fs')
const path = require('path')
const request = require('supertest')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const { MongoMemoryServer } = require('mongodb-memory-server')

const createApp = require('../app')
const User = require('../models/User')
const Transaction = require('../models/Transaction')

jest.setTimeout(30000)

let mongo
let app

const uploadDir = path.join(__dirname, 'tmp-transaction-uploads')

const tokenFor = (user) => jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET)

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
  currency: 'AED',
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
  process.env.TRANSACTION_UPLOAD_DIR = uploadDir
  process.env.SERVER_BASE_URL = 'http://localhost:5000'

  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
  app = createApp()
})

afterEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Transaction.deleteMany({}),
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
        currency: 'AED',
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
})