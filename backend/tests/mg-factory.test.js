const request = require('supertest')
const mongoose = require('mongoose')
const {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')

const createApp = require('../app')
const User = require('../models/User')
const FactoryDepartmentCredential = require('../models/FactoryDepartmentCredential')
const ProductionAlert = require('../models/ProductionAlert')
const ProductionBatch = require('../models/ProductionBatch')
const ProductionPass = require('../models/ProductionPass')
const { connectTenant } = require('../db/tenantConnections')
const { registerAllOnConnection } = require('../db/tenantModelRegistry')
const { runWithTenantConnection } = require('../db/tenantModelProxy')

let mongo
let app

function withDbName(uri, dbName) {
  const parsed = new URL(uri)
  parsed.pathname = `/${dbName}`
  return parsed.toString()
}

const createTenantUser = async (tenant, overrides = {}) => {
  const TenantUser = await User.getTenantModel(tenant)
  const now = Date.now().toString(36)
  return TenantUser.create({
    name: `${tenant}-factory-${now}`,
    email: `${tenant}-factory-${now}@example.com`,
    password: 'password123',
    role: 'super_admin',
    department: 'production',
    productionRole: 'production_manager',
    ...overrides,
  })
}

async function seedDepartment(key, password, label) {
  const Cred = await FactoryDepartmentCredential.getTenantModel('mg')
  const passwordHash = await FactoryDepartmentCredential.hashPassword(password)
  await Cred.findOneAndUpdate(
    { departmentKey: key },
    { departmentKey: key, label: label || key, passwordHash, active: true },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
}

async function loginFactoryEmployee(departmentKey, deptPassword, user) {
  const dept = await request(app)
    .post('/api/mg-factory/department/login')
    .set('Host', 'api.loopcstrategies.com')
    .set('x-tenant', 'mg')
    .set('X-Client', 'mg-factory')
    .send({ departmentKey, password: deptPassword })
  expect(dept.status).toBe(200)

  const emp = await request(app)
    .post('/api/mg-factory/employee/login')
    .set('Host', 'api.loopcstrategies.com')
    .set('x-tenant', 'mg')
    .set('X-Client', 'mg-factory')
    .set('Authorization', `Bearer ${dept.body.departmentToken}`)
    .send({ name: user.name, password: 'password123' })
  expect(emp.status).toBe(200)
  return emp.body.token
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.RATE_LIMIT_MAX = '100000'
  process.env.AUTH_RATE_LIMIT_MAX = '100000'
  process.env.DEFAULT_TENANT = 'loopc'

  mongo = await startMongoMemoryServer()
  const baseUri = mongo.getUri()
  process.env.MONGO_URI = withDbName(baseUri, 'default')
  process.env.MONGO_URI_LOOPC = withDbName(baseUri, 'loopc')
  process.env.MONGO_URI_MG = withDbName(baseUri, 'mg')
  process.env.MONGO_URI_CG = withDbName(baseUri, 'cg')
  process.env.MONGO_URI_VB = withDbName(baseUri, 'vb')

  await mongoose.connect(process.env.MONGO_URI_MG)
  app = createApp()
  process.env.NODE_ENV = 'test'
}, 120000)

afterEach(async () => {
  if (!isMongooseConnected(mongoose)) return
  const mgConn = await connectTenant('mg')
  registerAllOnConnection(mgConn)
  await runWithTenantConnection(mgConn, 'mg', async () => {
    await Promise.all([
      (await User.getTenantModel('mg')).deleteMany({}),
      (await FactoryDepartmentCredential.getTenantModel('mg')).deleteMany({}),
      ProductionAlert.deleteMany({}),
      ProductionBatch.deleteMany({}),
      ProductionPass.deleteMany({}),
    ])
  })
}, 60000)

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
}, 60000)

describe('MG Factory auth + call manager', () => {
  test('department login rejects bad password', async () => {
    await seedDepartment('melting', 'melting123', 'Melting')
    const res = await request(app)
      .post('/api/mg-factory/department/login')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('X-Client', 'mg-factory')
      .send({ departmentKey: 'melting', password: 'wrong' })

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  test('department login then employee login then me + call-manager', async () => {
    await seedDepartment('melting', 'melting123', 'Melting')
    const user = await createTenantUser('mg', { name: 'melt-op', password: 'password123' })

    const dept = await request(app)
      .post('/api/mg-factory/department/login')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('X-Client', 'mg-factory')
      .send({ departmentKey: 'melting', password: 'melting123' })

    expect(dept.status).toBe(200)
    expect(dept.body.departmentToken).toBeTruthy()
    expect(dept.body.department.key).toBe('melting')

    const emp = await request(app)
      .post('/api/mg-factory/employee/login')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('X-Client', 'mg-factory')
      .set('Authorization', `Bearer ${dept.body.departmentToken}`)
      .send({ name: user.name, password: 'password123' })

    expect(emp.status).toBe(200)
    expect(emp.body.token).toBeTruthy()
    expect(emp.body.department.key).toBe('melting')

    const me = await request(app)
      .get('/api/mg-factory/me')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('X-Client', 'mg-factory')
      .set('Authorization', `Bearer ${emp.body.token}`)

    expect(me.status).toBe(200)
    expect(me.body.tenant).toBe('mg')
    expect(me.body.department.key).toBe('melting')
    expect(me.body.user.name).toBe(user.name)

    const call = await request(app)
      .post('/api/mg-factory/call-manager')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('X-Client', 'mg-factory')
      .set('Authorization', `Bearer ${emp.body.token}`)
      .send({ message: 'Need help at melting' })

    expect(call.status).toBe(201)
    expect(call.body.success).toBe(true)
    expect(call.body.alert).toBeTruthy()
    expect(call.body.alert.code).toBe('CALL_FLOOR_MANAGER')
    expect(call.body.alert.status).toBe('OPEN')
    expect(call.body.alert.severity).toBe('critical')
  })

  test('employee login rejected without department token', async () => {
    const res = await request(app)
      .post('/api/mg-factory/employee/login')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('X-Client', 'mg-factory')
      .send({ name: 'anyone', password: 'password123' })

    expect(res.status).toBe(401)
  })
})

describe('MG Factory metal IN/OUT number lookup', () => {
  test('metal OUT resolves batch by batchNumber', async () => {
    await seedDepartment('melting', 'melting123', 'Melting')
    const user = await createTenantUser('mg', { name: 'melt-out-op', password: 'password123' })
    const token = await loginFactoryEmployee('melting', 'melting123', user)

    const Batch = await ProductionBatch.getTenantModel('mg')
    await Batch.create({
      batchNumber: 'MG-FACTORY-OUT-1',
      metalType: 'Gold',
      initialWeight: 100,
      currentWeight: 100,
      currentDepartment: 'melting',
      currentLocation: 'melting',
      status: 'RECEIVED',
    })

    const res = await request(app)
      .post('/api/mg-factory/metal/out')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('X-Client', 'mg-factory')
      .set('Authorization', `Bearer ${token}`)
      .send({
        batchId: 'MG-FACTORY-OUT-1',
        toDepartment: 'casting',
        weight: 50,
        purpose: 'manual batch number',
        operationId: 'mgf-out-by-number-1',
      })

    expect([200, 201]).toContain(res.status)
    expect(res.body.success).toBe(true)
    expect(res.body.pass).toBeTruthy()
    expect(res.body.pass.batchNumber).toBe('MG-FACTORY-OUT-1')
    expect(res.body.pass.toDepartment).toBe('casting')
  })

  test('metal IN resolves pass by passNumber', async () => {
    await seedDepartment('casting', 'casting123', 'Casting')
    const user = await createTenantUser('mg', { name: 'cast-in-op', password: 'password123' })
    const token = await loginFactoryEmployee('casting', 'casting123', user)

    const Batch = await ProductionBatch.getTenantModel('mg')
    const Pass = await ProductionPass.getTenantModel('mg')
    const batch = await Batch.create({
      batchNumber: 'MG-FACTORY-IN-1',
      metalType: 'Gold',
      initialWeight: 80,
      currentWeight: 80,
      currentDepartment: 'melting',
      currentLocation: 'melting',
      status: 'IN_TRANSIT',
    })
    await Pass.create({
      passNumber: 'PASS-FACTORY-IN-1',
      batchId: batch._id,
      batchNumber: batch.batchNumber,
      fromDepartment: 'melting',
      toDepartment: 'casting',
      metalType: 'Gold',
      weight: 80,
      status: 'ISSUED',
      issuedAt: new Date(),
    })

    const res = await request(app)
      .post('/api/mg-factory/metal/in')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('X-Client', 'mg-factory')
      .set('Authorization', `Bearer ${token}`)
      .send({
        passId: 'PASS-FACTORY-IN-1',
        receivedWeight: 80,
        operationId: 'mgf-in-by-number-1',
      })

    expect([200, 201]).toContain(res.status)
    expect(res.body.success).toBe(true)
    expect(res.body.pass).toBeTruthy()
    expect(res.body.pass.passNumber).toBe('PASS-FACTORY-IN-1')
    expect(res.body.weight).toBe(80)
  })

  test('metal OUT returns 404 for unknown batchNumber', async () => {
    await seedDepartment('melting', 'melting123', 'Melting')
    const user = await createTenantUser('mg', { name: 'melt-miss', password: 'password123' })
    const token = await loginFactoryEmployee('melting', 'melting123', user)

    const res = await request(app)
      .post('/api/mg-factory/metal/out')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('X-Client', 'mg-factory')
      .set('Authorization', `Bearer ${token}`)
      .send({
        batchId: 'DOES-NOT-EXIST',
        toDepartment: 'casting',
        weight: 10,
      })

    expect(res.status).toBe(404)
    expect(String(res.body.message || '')).toMatch(/batch not found/i)
  })
})
