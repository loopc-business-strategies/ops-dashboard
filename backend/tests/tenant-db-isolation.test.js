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

const TENANTS = ['mg', 'cg', 'loopc', 'vb']
const PAIRS = [
  ['mg', 'cg'],
  ['mg', 'loopc'],
  ['mg', 'vb'],
  ['cg', 'loopc'],
  ['cg', 'vb'],
  ['loopc', 'vb'],
]

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
  process.env.MONGO_URI_VB = withDbName(baseUri, 'ops_vb_test')

  await mongoose.connect(process.env.MONGO_URI_LOOPC)
})

afterEach(async () => {
  if (!isMongooseConnected(mongoose)) return
  await Promise.all(TENANTS.flatMap((tenant) => [
    User.getTenantModel(tenant).then((Model) => Model.deleteMany({})),
    Customer.getTenantModel(tenant).then((Model) => Model.deleteMany({})),
  ]))
})

afterAll(async () => {
  if (isMongooseConnected(mongoose)) {
    await Promise.all(
      TENANTS.map((tenant) => connectTenant(tenant).then((conn) => conn.close()).catch(() => {})),
    )
  }
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('Tenant physical DB isolation', () => {
  test('tenant connections point to different databases', async () => {
    const conns = {}
    for (const tenant of TENANTS) {
      conns[tenant] = await connectTenant(tenant)
    }
    expect(conns.mg.name).toBe('ops_mg_test')
    expect(conns.cg.name).toBe('ops_cg_test')
    expect(conns.loopc.name).toBe('ops_loopc_test')
    expect(conns.vb.name).toBe('ops_vb_test')
    const names = TENANTS.map((t) => conns[t].name)
    expect(new Set(names).size).toBe(TENANTS.length)
  })

  test.each(PAIRS)('%s records are invisible to %s (users and customers)', async (tenantA, tenantB) => {
    const UserA = await User.getTenantModel(tenantA)
    const UserB = await User.getTenantModel(tenantB)
    const CustomerA = await Customer.getTenantModel(tenantA)
    const CustomerB = await Customer.getTenantModel(tenantB)

    const user = await UserA.create({
      name: `${tenantA}-user`,
      email: `${tenantA}-user@example.com`,
      password: 'password123',
      role: 'super_admin',
    })

    await CustomerA.create({
      name: `${tenantA} Customer Only`,
      openingBalance: 0,
      createdBy: user._id,
    })

    expect(await UserA.countDocuments()).toBe(1)
    expect(await UserB.countDocuments()).toBe(0)
    expect(await CustomerA.countDocuments()).toBe(1)
    expect(await CustomerB.countDocuments()).toBe(0)
    expect(await UserB.findById(user._id)).toBeNull()
  })
})
