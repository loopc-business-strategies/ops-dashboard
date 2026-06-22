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
  const mgConn = await connectTenant('mg')
  registerAllOnConnection(mgConn)
  await runWithTenantConnection(mgConn, 'mg', () => Transaction.deleteMany({}))
  await Promise.all([
    (await User.getTenantModel('mg')).deleteMany({}),
    (await User.getTenantModel('loopc')).deleteMany({}),
  ])
})

afterAll(async () => {
  if (isMongooseConnected(mongoose)) {
    await Promise.all([
      connectTenant('mg').then((conn) => conn.close()).catch(() => {}),
      connectTenant('loopc').then((conn) => conn.close()).catch(() => {}),
    ])
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

    const mgConn = await connectTenant('mg')
    registerAllOnConnection(mgConn)
    await runWithTenantConnection(mgConn, 'mg', () =>
      Transaction.insertMany(
        Array.from({ length: 43 }, (_, index) => postedReceipt(mgUser._id, index)),
      ),
    )

    await Transaction.insertMany([
      postedReceipt(loopcUser._id, 1),
      postedReceipt(loopcUser._id, 2),
    ])

    const mobileRes = await request(app)
      .get('/api/erp-accounting/transactions')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('x-company', 'mg')
      .set('X-Client', 'mobile')
      .set('Authorization', `Bearer ${tokenFor(mgUser, 'mg')}`)

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
})
