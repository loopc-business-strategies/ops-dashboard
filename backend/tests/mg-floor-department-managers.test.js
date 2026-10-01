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

let mongo
let app

const HOST = 'api.loopcstrategies.com'
const tokenFor = (user, tenant) => jwt.sign({ id: user._id.toString(), company: tenant }, process.env.JWT_SECRET)

function withDbName(uri, dbName) {
  const parsed = new URL(uri)
  parsed.pathname = `/${dbName}`
  return parsed.toString()
}

let seq = 0
const createUser = async (overrides = {}) => {
  const TenantUser = await User.getTenantModel('mg')
  seq += 1
  const tag = `${Date.now().toString(36)}${seq}`
  return TenantUser.create({
    name: `mg-user-${tag}`,
    email: `mg-user-${tag}@example.com`,
    password: 'password123',
    role: 'department_user',
    department: 'production',
    productionRole: 'operator',
    ...overrides,
  })
}
const createOperator = () => createUser({ productionRole: 'operator', floorDepartment: 'melting' })
const createFloorManager = (overrides = {}) => createUser({ role: 'department_head', productionRole: 'floor_manager', ...overrides })

const headers = (user) => ({
  Host: HOST,
  'x-tenant': 'mg',
  Authorization: `Bearer ${tokenFor(user, 'mg')}`,
})

const assign = (user, department, managerId) =>
  request(app).put(`/api/mg-floor/department-managers/${department}`).set(headers(user)).send({ managerId })
const assigned = (user) => request(app).get('/api/mg-floor/department-managers').set(headers(user))

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
  const models = ['MgFloorSetting', 'AuditLog', 'User']
  await Promise.all(models.map(async (name) => (await require(`../models/${name}`).getTenantModel('mg')).deleteMany({})))
}, 60000)

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
}, 60000)

describe('MG Floor assigned manager per department', () => {
  test('the Assign Manager list is real Floor / Production Managers only, for managers only', async () => {
    const op = await createOperator()
    const fm = await createFloorManager({ name: 'B Floor' })
    const pm = await createUser({ name: 'A Production', role: 'department_user', productionRole: 'production_manager' })
    const head = await createUser({ name: 'C Head', role: 'department_head', department: 'production', productionRole: undefined })
    await createFloorManager({ name: 'D Inactive', isActive: false })
    await createUser({ name: 'E Admin', role: 'super_admin', department: '', productionRole: undefined })
    await createUser({ name: 'F Management', role: 'management', department: 'management', productionRole: undefined })
    await createUser({ name: 'G Sales head', role: 'department_head', department: 'sales', productionRole: undefined })

    const url = '/api/mg-floor/department-managers/options'
    expect((await request(app).get(url).set(headers(op))).status).toBe(403)
    const res = await request(app).get(url).set(headers(fm))
    expect(res.status).toBe(200)
    expect(res.body.managers).toEqual([
      { id: String(pm._id), name: 'A Production', productionRole: 'production_manager' },
      { id: String(fm._id), name: 'B Floor', productionRole: 'floor_manager' },
      { id: String(head._id), name: 'C Head', productionRole: 'floor_manager' },
    ])
  })

  test('managers assign per department; every tablet reads it; audited; follows renames and deactivation', async () => {
    const op = await createOperator()
    const fm = await createFloorManager()
    const pm = await createUser({ name: 'Ravi', productionRole: 'production_manager' })

    expect((await assign(op, 'melting', String(pm._id))).status).toBe(403)
    expect((await assign(fm, 'melting', String(op._id))).status).toBe(400)
    expect((await assign(fm, 'nowhere', String(pm._id))).status).toBe(400)
    expect((await assign(fm, 'melting', 'not-an-id')).status).toBe(400)

    const set = await assign(fm, 'melting', String(pm._id))
    expect(set.status).toBe(200)
    expect(set.body).toMatchObject({ department: 'melting', manager: { id: String(pm._id), name: 'Ravi', assignedByName: fm.name } })

    const read = await assigned(op)
    expect(read.status).toBe(200)
    expect(read.body.canAssign).toBe(false)
    expect(read.body.managers).toEqual({ melting: expect.objectContaining({ id: String(pm._id), name: 'Ravi' }) })
    expect((await assigned(fm)).body.canAssign).toBe(true)

    const AuditLog = await require('../models/AuditLog').getTenantModel('mg')
    const audit = await AuditLog.findOne({ action: 'mg_floor_manager_assigned' }).lean()
    expect(audit).toMatchObject({ actorName: fm.name, changes: { department: 'melting', from: null, to: 'Ravi' } })

    const TenantUser = await User.getTenantModel('mg')
    await TenantUser.updateOne({ _id: pm._id }, { $set: { name: 'Ravi Kumar' } })
    expect((await assigned(op)).body.managers.melting.name).toBe('Ravi Kumar')

    await TenantUser.updateOne({ _id: pm._id }, { $set: { isActive: false } })
    expect((await assigned(op)).body.managers).toEqual({})

    await TenantUser.updateOne({ _id: pm._id }, { $set: { isActive: true } })
    const cleared = await assign(fm, 'melting', null)
    expect(cleared.status).toBe(200)
    expect(cleared.body.manager).toBeNull()
    expect((await assigned(op)).body.managers).toEqual({})
  })

  test('assigning a manager leaves the loss limit and its last-changed time alone', async () => {
    const fm = await createFloorManager()
    const pm = await createUser({ productionRole: 'production_manager' })
    await request(app).put('/api/mg-floor/batch-stats/loss-limit').set(headers(fm)).send({ department: 'melting', lossLimitPct: 0.5 })
    const settings = () => request(app).get('/api/mg-floor/batch-stats/loss-limit-settings').set(headers(fm))
    const before = (await settings()).body.departments.find((d) => d.department === 'melting')

    await new Promise((r) => setTimeout(r, 20))
    await assign(fm, 'melting', String(pm._id))
    await assign(fm, 'rolling', String(pm._id))

    const after = (await settings()).body.departments
    expect(after.find((d) => d.department === 'melting')).toMatchObject({ lossLimitPct: 0.5, lossLimitSetAt: before.lossLimitSetAt })
    expect(after.find((d) => d.department === 'rolling')).toMatchObject({ lossLimitPct: null, lossLimitSetAt: null })
  })
})
