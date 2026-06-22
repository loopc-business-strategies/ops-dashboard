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
const Transaction = require('../models/Transaction')
const { connectTenant } = require('../db/tenantConnections')
const { runWithTenantConnection } = require('../db/tenantModelProxy')
const { registerAllOnConnection } = require('../db/tenantModelRegistry')

let mongo
let app

const tokenFor = (user, tenant) => jwt.sign({ id: user._id.toString(), company: tenant }, process.env.JWT_SECRET)

function withDbName(uri, dbName) {
  const parsed = new URL(uri)
  parsed.pathname = `/${dbName}`
  return parsed.toString()
}

const postedReceipt = (createdBy, suffix = '') => ({
  type: 'receipt',
  amount: 1000 + suffix,
  date: new Date('2026-04-06T00:00:00.000Z'),
  currency: 'INR',
  exchangeRate: 1,
  description: `receipt ${suffix}`,
  status: 'posted',
  createdBy,
  updatedBy: createdBy,
})

async function seedTenantTransactions(tenant, user, count) {
  const conn = await connectTenant(tenant)
  registerAllOnConnection(conn)
  await runWithTenantConnection(conn, tenant, () =>
    Transaction.insertMany(
      Array.from({ length: count }, (_, index) => postedReceipt(user._id, index)),
    ),
  )
}

async function mobileTransactionsRequest(tenant, user) {
  return request(app)
    .get('/api/erp-accounting/transactions')
    .set('Host', 'api.loopcstrategies.com')
    .set('x-tenant', tenant)
    .set('x-company', tenant)
    .set('X-Client', 'mobile')
    .set('Authorization', `Bearer ${tokenFor(user, tenant)}`)
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.RATE_LIMIT_MAX = '100000'
  process.env.AUTH_RATE_LIMIT_MAX = '100000'
  process.env.DEFAULT_TENANT = 'loopc'

  mongo = await startMongoMemoryServer()
  const baseUri = mongo.getUri()
  process.env.MONGO_URI_LOOPC = withDbName(baseUri, 'ops_loopc_mobile_tx')
  process.env.MONGO_URI_MG = withDbName(baseUri, 'ops_mg_mobile_tx')
  process.env.MONGO_URI_CG = withDbName(baseUri, 'ops_cg_mobile_tx')

  await mongoose.connect(process.env.MONGO_URI_LOOPC)
  app = createApp()
})

afterEach(async () => {
  if (!isMongooseConnected(mongoose)) return
  await Transaction.deleteMany({})
  for (const tenant of ['mg', 'cg', 'loopc']) {
    const conn = await connectTenant(tenant)
    registerAllOnConnection(conn)
    await runWithTenantConnection(conn, tenant, () => Transaction.deleteMany({}))
  }
  await Promise.all([
    (await User.getTenantModel('mg')).deleteMany({}),
    (await User.getTenantModel('cg')).deleteMany({}),
    (await User.getTenantModel('loopc')).deleteMany({}),
  ])
})

afterAll(async () => {
  if (isMongooseConnected(mongoose)) {
    await Promise.all(
      ['mg', 'cg', 'loopc'].map((tenant) =>
        connectTenant(tenant)
          .then((conn) => conn.close())
          .catch(() => {}),
      ),
    )
  }
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('Mobile Bearer tenant DB binding for transactions', () => {
  test('Bearer mobile client reads MG transactions, not default LoopC DB', async () => {
    const MgUser = await User.getTenantModel('mg')
    const mgUser = await MgUser.create({
      name: 'mg-super',
      email: 'mg-super@example.com',
      password: 'password123',
      role: 'super_admin',
      allowedModules: ['erp'],
    })

    const LoopcUser = await User.getTenantModel('loopc')
    const loopcUser = await LoopcUser.create({
      name: 'loopc-user',
      email: 'loopc-user@example.com',
      password: 'password123',
      role: 'super_admin',
    })

    await seedTenantTransactions('mg', mgUser, 43)
    await Transaction.insertMany([
      postedReceipt(loopcUser._id, 1),
      postedReceipt(loopcUser._id, 2),
    ])

    const mobileRes = await mobileTransactionsRequest('mg', mgUser)

    expect(mobileRes.status).toBe(200)
    expect(mobileRes.body.success).toBe(true)
    expect(Number(mobileRes.body.summary?.totalCount || 0)).toBe(43)
    expect(mobileRes.body.transactions).toHaveLength(43)

    const cookieRes = await request(app)
      .get('/api/erp-accounting/transactions')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Cookie', `sessionToken_mg=${tokenFor(mgUser, 'mg')}`)

    expect(cookieRes.status).toBe(200)
    expect(Number(cookieRes.body.summary?.totalCount || 0)).toBe(43)
  })

  test('Bearer mobile client reads CG transactions, not default LoopC DB', async () => {
    const CgUser = await User.getTenantModel('cg')
    const cgUser = await CgUser.create({
      name: 'cg-super',
      email: 'cg-super@example.com',
      password: 'password123',
      role: 'super_admin',
      allowedModules: ['erp'],
    })

    const LoopcUser = await User.getTenantModel('loopc')
    const loopcUser = await LoopcUser.create({
      name: 'loopc-user-cg',
      email: 'loopc-user-cg@example.com',
      password: 'password123',
      role: 'super_admin',
    })

    await seedTenantTransactions('cg', cgUser, 17)
    await Transaction.insertMany([
      postedReceipt(loopcUser._id, 101),
      postedReceipt(loopcUser._id, 102),
    ])

    const mobileRes = await mobileTransactionsRequest('cg', cgUser)

    expect(mobileRes.status).toBe(200)
    expect(mobileRes.body.success).toBe(true)
    expect(Number(mobileRes.body.summary?.totalCount || 0)).toBe(17)
    expect(mobileRes.body.transactions).toHaveLength(17)
  })

  test('Bearer mobile client reads LoopC transactions from LoopC DB', async () => {
    const LoopcUser = await User.getTenantModel('loopc')
    const loopcUser = await LoopcUser.create({
      name: 'loopc-super',
      email: 'loopc-super@example.com',
      password: 'password123',
      role: 'super_admin',
      allowedModules: ['erp'],
    })

    const MgUser = await User.getTenantModel('mg')
    const mgUser = await MgUser.create({
      name: 'mg-user-loopc',
      email: 'mg-user-loopc@example.com',
      password: 'password123',
      role: 'super_admin',
    })

    await seedTenantTransactions('loopc', loopcUser, 5)
    await seedTenantTransactions('mg', mgUser, 99)

    const mobileRes = await mobileTransactionsRequest('loopc', loopcUser)

    expect(mobileRes.status).toBe(200)
    expect(mobileRes.body.success).toBe(true)
    expect(Number(mobileRes.body.summary?.totalCount || 0)).toBe(5)
    expect(mobileRes.body.transactions).toHaveLength(5)
  })
})
