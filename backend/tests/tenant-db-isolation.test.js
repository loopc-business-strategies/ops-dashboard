const mongoose = require('mongoose')
const {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')

const User = require('../models/User')
const Customer = require('../models/Customer')
const { connectTenant } = require('../db/tenantConnections')

let mongo

function withDbName(uri, dbName) {
  const parsed = new URL(uri)
  parsed.pathname = `/${dbName}`
  return parsed.toString()
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.DEFAULT_TENANT = 'loopc'

  mongo = await startMongoMemoryServer()
  const baseUri = mongo.getUri()

  process.env.MONGO_URI_MG = withDbName(baseUri, 'ops_mg_test')
  process.env.MONGO_URI_CG = withDbName(baseUri, 'ops_cg_test')
  process.env.MONGO_URI_LOOPC = withDbName(baseUri, 'ops_loopc_test')

  await mongoose.connect(process.env.MONGO_URI_LOOPC)
})

afterEach(async () => {
  if (!isMongooseConnected(mongoose)) return
  await Promise.all([
    (await User.getTenantModel('mg')).deleteMany({}),
    (await User.getTenantModel('cg')).deleteMany({}),
    (await User.getTenantModel('loopc')).deleteMany({}),
    (await Customer.getTenantModel('mg')).deleteMany({}),
    (await Customer.getTenantModel('cg')).deleteMany({}),
    (await Customer.getTenantModel('loopc')).deleteMany({}),
  ])
})

afterAll(async () => {
  if (isMongooseConnected(mongoose)) {
    await Promise.all([
      connectTenant('mg').then((conn) => conn.close()).catch(() => {}),
      connectTenant('cg').then((conn) => conn.close()).catch(() => {}),
      connectTenant('loopc').then((conn) => conn.close()).catch(() => {}),
    ])
  }
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('Tenant physical DB isolation', () => {
  test('creates records in mg without leaking into cg/loopc', async () => {
    const MgUser = await User.getTenantModel('mg')
    const CgUser = await User.getTenantModel('cg')
    const LoopcUser = await User.getTenantModel('loopc')

    const mgUser = await MgUser.create({
      name: 'mg-user',
      email: 'mg-user@example.com',
      password: 'password123',
      role: 'super_admin',
    })

    expect(await MgUser.countDocuments()).toBe(1)
    expect(await CgUser.countDocuments()).toBe(0)
    expect(await LoopcUser.countDocuments()).toBe(0)

    const MgCustomer = await Customer.getTenantModel('mg')
    const CgCustomer = await Customer.getTenantModel('cg')
    const LoopcCustomer = await Customer.getTenantModel('loopc')

    await MgCustomer.create({
      name: 'MG Customer Only',
      openingBalance: 0,
      createdBy: mgUser._id,
    })

    expect(await MgCustomer.countDocuments()).toBe(1)
    expect(await CgCustomer.countDocuments()).toBe(0)
    expect(await LoopcCustomer.countDocuments()).toBe(0)
  })

  test('tenant connections point to different databases', async () => {
    const mgConn = await connectTenant('mg')
    const cgConn = await connectTenant('cg')
    const loopcConn = await connectTenant('loopc')

    expect(mgConn.name).toBe('ops_mg_test')
    expect(cgConn.name).toBe('ops_cg_test')
    expect(loopcConn.name).toBe('ops_loopc_test')

    expect(mgConn.name).not.toBe(cgConn.name)
    expect(cgConn.name).not.toBe(loopcConn.name)
    expect(mgConn.name).not.toBe(loopcConn.name)
  })
})
