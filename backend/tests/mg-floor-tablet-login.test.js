const request = require('supertest')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')

const createApp = require('../app')
const User = require('../models/User')
const MgFloorAttendance = require('../models/MgFloorAttendance')

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
const createTenantUser = async (tenant, overrides = {}) => {
  const TenantUser = await User.getTenantModel(tenant)
  seq += 1
  const tag = `${Date.now().toString(36)}${seq}`
  return TenantUser.create({
    name: `${tenant}-floor-${tag}`,
    email: `${tenant}-floor-${tag}@example.com`,
    password: 'password123',
    role: 'department_user',
    department: 'production',
    floorDepartment: 'melting',
    ...overrides,
  })
}

/** A user who set a floor PIN before PIN login was retired. */
const createUserWithOldPin = async (overrides = {}) => createTenantUser('mg', {
  floorPinHash: await bcrypt.hash('2580', 4),
  floorPinSetAt: new Date('2026-09-01T00:00:00Z'),
  ...overrides,
})

const floorClient = (req) => req.set('Host', HOST).set('x-tenant', 'mg').set('X-Client', 'mg-floor')
const bearer = (user, tenant = 'mg') => ({ Authorization: `Bearer ${tokenFor(user, tenant)}` })
const PIN_FIELDS = /floorPin|hasFloorPin|\$2[aby]\$/

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
  await Promise.all([
    (await User.getTenantModel('mg')).deleteMany({}),
    (await MgFloorAttendance.getTenantModel('mg')).deleteMany({}),
  ])
}, 60000)

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
}, 60000)

describe('MG Floor login is ID + password only (PIN login retired)', () => {
  test('PIN login and self-service PIN endpoints no longer exist', async () => {
    const user = await createUserWithOldPin({ employeeCode: 'MG-104' })

    const pinLogin = await floorClient(request(app).post('/api/auth/pin-login')).send({ employee: 'MG-104', pin: '2580' })
    expect(pinLogin.status).toBe(404)
    expect(pinLogin.body.token).toBeUndefined()

    const setPin = await floorClient(request(app).post('/api/mg-floor/me/pin')).set(bearer(user)).send({ password: 'password123', pin: '4826' })
    expect(setPin.status).toBe(404)
  })

  test('username + password logs in from the tablet and never returns PIN fields', async () => {
    const user = await createUserWithOldPin()

    const res = await floorClient(request(app).post('/api/auth/login')).send({ name: user.name, password: 'password123' })
    expect(res.status).toBe(200)
    expect(typeof res.body.token).toBe('string')
    expect(JSON.stringify(res.body)).not.toMatch(PIN_FIELDS)

    const me = await floorClient(request(app).get('/api/auth/me')).set(bearer(user))
    expect(me.status).toBe(200)
    expect(JSON.stringify(me.body)).not.toMatch(PIN_FIELDS)

    const floorMe = await floorClient(request(app).get('/api/mg-floor/me')).set(bearer(user))
    expect(floorMe.status).toBe(200)
    expect(JSON.stringify(floorMe.body)).not.toMatch(PIN_FIELDS)
  })

  test('admin user create / edit / list ignore floor PIN fields and hide old PIN data', async () => {
    const admin = await createTenantUser('mg', { role: 'super_admin', floorDepartment: '' })
    const headers = { Host: HOST, 'x-tenant': 'mg', ...bearer(admin) }

    const created = await request(app).post('/api/auth/users').set(headers)
      .send({ name: 'Floor Worker', password: 'Password123!', role: 'department_user', department: 'production', floorPin: '2580' })
    expect(created.status).toBe(201)
    expect(JSON.stringify(created.body)).not.toMatch(PIN_FIELDS)

    const worker = await createUserWithOldPin({ employeeCode: 'MG-501' })
    const edited = await request(app).put(`/api/auth/users/${worker._id}/role`).set(headers)
      .send({ role: 'department_user', department: 'production', employeeCode: 'MG-501', floorPin: '4826', clearFloorPin: true })
    expect(edited.status).toBe(200)
    expect(JSON.stringify(edited.body)).not.toMatch(PIN_FIELDS)

    const list = await request(app).get('/api/auth/users').set(headers)
    expect(list.status).toBe(200)
    expect(JSON.stringify(list.body)).not.toMatch(PIN_FIELDS)
  })
})

describe('tablet attendance', () => {
  test('operators record login and logout; a second login while open reuses the row', async () => {
    const op = await createTenantUser('mg', { employeeCode: 'MG-700' })
    const call = (path, body = {}) => floorClient(request(app).post(`/api/mg-floor/attendance/${path}`)).set(bearer(op)).send(body)

    const first = await call('login', { loginMethod: 'password', deviceLabel: 'Melting tablet' })
    expect(first.status).toBe(201)
    expect(first.body.attendance.productionRole).toBe('operator')
    expect(first.body.attendance.floorDepartment).toBe('melting')

    const again = await call('login', { loginMethod: 'biometric' })
    expect(again.status).toBe(200)
    expect(again.body.reused).toBe(true)

    const out = await call('logout')
    expect(out.status).toBe(200)
    expect(out.body.closed).toBe(1)

    const outAgain = await call('logout')
    expect(outAgain.status).toBe(200)
    expect(outAgain.body.closed).toBe(0)

    const Model = await MgFloorAttendance.getTenantModel('mg')
    const rows = await Model.find({ userId: op._id }).lean()
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('CLOSED')
    expect(rows[0].closedBy).toBe('user')
    expect(rows[0].loginMethod).toBe('password')
  })

  test('a login left open from a previous day is closed automatically on the next login', async () => {
    const op = await createTenantUser('mg')
    const Model = await MgFloorAttendance.getTenantModel('mg')
    const old = new Date(Date.now() - 20 * 60 * 60 * 1000)
    await Model.create({ userId: op._id, name: op.name, loginAt: old, lastActivityAt: old })

    const res = await floorClient(request(app).post('/api/mg-floor/attendance/login')).set(bearer(op)).send({})
    expect(res.status).toBe(201)
    const rows = await Model.find({ userId: op._id }).sort({ loginAt: 1 }).lean()
    expect(rows.map((r) => r.status)).toEqual(['CLOSED', 'OPEN'])
    expect(rows[0].closedBy).toBe('auto')
  })

  test('managers can list attendance; operators cannot', async () => {
    const op = await createTenantUser('mg')
    const fm = await createTenantUser('mg', { role: 'department_head', floorDepartment: '' })
    await floorClient(request(app).post('/api/mg-floor/attendance/login')).set(bearer(op)).send({})

    const denied = await floorClient(request(app).get('/api/mg-floor/attendance')).set(bearer(op))
    expect(denied.status).toBe(403)

    const list = await floorClient(request(app).get('/api/mg-floor/attendance')).set(bearer(fm))
    expect(list.status).toBe(200)
    expect(list.body.attendance.map((r) => r.name)).toContain(op.name)
  })

  test('a from/to day window lists everyone on the floor that day, including overnight and still-open logins', async () => {
    const fm = await createTenantUser('mg', { role: 'department_head', floorDepartment: '' })
    const Model = await MgFloorAttendance.getTenantModel('mg')
    const from = new Date('2026-09-30T20:00:00.000Z')
    const to = new Date('2026-10-01T20:00:00.000Z')
    const at = (iso) => new Date(iso)
    const row = (name, loginAt, logoutAt = null) => ({
      userId: fm._id,
      name,
      loginAt: at(loginAt),
      lastActivityAt: at(logoutAt || loginAt),
      logoutAt: logoutAt ? at(logoutAt) : null,
      status: logoutAt ? 'CLOSED' : 'OPEN',
    })
    await Model.create([
      row('night-shift', '2026-09-30T18:00:00Z', '2026-09-30T23:30:00Z'),
      row('still-open', '2026-09-30T16:00:00Z'),
      row('day-shift', '2026-10-01T05:00:00Z', '2026-10-01T13:00:00Z'),
      row('yesterday-only', '2026-09-30T05:00:00Z', '2026-09-30T13:00:00Z'),
      row('tomorrow', '2026-10-01T21:00:00Z'),
    ])

    const res = await floorClient(request(app).get('/api/mg-floor/attendance'))
      .query({ from: from.toISOString(), to: to.toISOString() })
      .set(bearer(fm))
    expect(res.status).toBe(200)
    expect(res.body.attendance.map((r) => r.name).sort()).toEqual(['day-shift', 'night-shift', 'still-open'])

    const bad = await floorClient(request(app).get('/api/mg-floor/attendance'))
      .query({ from: from.toISOString() })
      .set(bearer(fm))
    expect(bad.status).toBe(400)
  })
})
