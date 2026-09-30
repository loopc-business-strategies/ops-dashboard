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
const MgFloorAttendance = require('../models/MgFloorAttendance')
const { applyFloorPin, floorPinError } = require('../services/mgFloorPin')

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
    name: `${tenant}-pin-${tag}`,
    email: `${tenant}-pin-${tag}@example.com`,
    password: 'password123',
    role: 'department_user',
    department: 'production',
    floorDepartment: 'melting',
    ...overrides,
  })
}

const withPin = async (user, pin) => {
  await applyFloorPin(user, pin)
  await user.save({ validateBeforeSave: false })
  return user
}

const floorClient = (req) => req.set('Host', HOST).set('x-tenant', 'mg').set('X-Client', 'mg-floor')
const bearer = (user, tenant = 'mg') => ({ Authorization: `Bearer ${tokenFor(user, tenant)}` })

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
    (await User.getTenantModel('cg')).deleteMany({}),
    (await MgFloorAttendance.getTenantModel('mg')).deleteMany({}),
  ])
}, 60000)

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
}, 60000)

describe('floor PIN rules', () => {
  test('accepts 4-6 digits and rejects repeated digits and simple sequences', () => {
    expect(floorPinError('2580')).toBeNull()
    expect(floorPinError('739104')).toBeNull()
    expect(floorPinError('123')).toMatch(/4 to 6 digits/)
    expect(floorPinError('12a4')).toMatch(/4 to 6 digits/)
    expect(floorPinError('1111')).toMatch(/same digit/)
    expect(floorPinError('1234')).toMatch(/sequence/)
    expect(floorPinError('9876')).toMatch(/sequence/)
  })
})

describe('POST /api/auth/pin-login', () => {
  test('employee code + PIN returns a mobile token; the PIN hash is never returned', async () => {
    const user = await withPin(await createTenantUser('mg', { employeeCode: 'MG-104' }), '2580')

    const res = await floorClient(request(app).post('/api/auth/pin-login')).send({ employee: 'mg-104', pin: '2580' })

    expect(res.status).toBe(200)
    expect(typeof res.body.token).toBe('string')
    expect(res.body.user.id).toBe(String(user._id))
    expect(res.body.user.hasFloorPin).toBe(true)
    expect(JSON.stringify(res.body)).not.toMatch(/floorPinHash|\$2[aby]\$/)
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  test('username also works as the employee ID', async () => {
    const user = await withPin(await createTenantUser('mg'), '4826')
    const res = await floorClient(request(app).post('/api/auth/pin-login')).send({ employee: user.name.toUpperCase(), pin: '4826' })
    expect(res.status).toBe(200)
  })

  test('wrong PIN is refused, and 5 wrong tries lock the PIN even for the right one', async () => {
    await withPin(await createTenantUser('mg', { employeeCode: 'MG-200' }), '2580')
    const attempt = (pin) => floorClient(request(app).post('/api/auth/pin-login')).send({ employee: 'MG-200', pin })

    for (let i = 0; i < 4; i += 1) {
      const res = await attempt('0852')
      expect(res.status).toBe(401)
      expect(res.body.message).toBe('Wrong employee ID or PIN.')
    }
    const fifth = await attempt('0852')
    expect(fifth.status).toBe(429)
    expect(fifth.body.code).toBe('FLOOR_PIN_LOCKED')

    const right = await attempt('2580')
    expect(right.status).toBe(429)
    expect(right.body.token).toBeUndefined()
  })

  test('a successful PIN resets the wrong-try counter', async () => {
    const user = await withPin(await createTenantUser('mg', { employeeCode: 'MG-201' }), '2580')
    const attempt = (pin) => floorClient(request(app).post('/api/auth/pin-login')).send({ employee: 'MG-201', pin })
    for (let i = 0; i < 4; i += 1) await attempt('0852')
    expect((await attempt('2580')).status).toBe(200)
    expect((await attempt('0852')).status).toBe(401)
    const TenantUser = await User.getTenantModel('mg')
    const fresh = await TenantUser.findById(user._id).select('+floorPinFailedCount')
    expect(fresh.floorPinFailedCount).toBe(1)
  })

  test('no PIN, unknown employee, deactivated account, and duplicate employee codes are refused', async () => {
    await createTenantUser('mg', { employeeCode: 'MG-300' })
    const noPin = await floorClient(request(app).post('/api/auth/pin-login')).send({ employee: 'MG-300', pin: '2580' })
    expect(noPin.status).toBe(401)
    expect(noPin.body.code).toBe('NO_FLOOR_PIN')

    const unknown = await floorClient(request(app).post('/api/auth/pin-login')).send({ employee: 'nobody', pin: '2580' })
    expect(unknown.status).toBe(401)

    await withPin(await createTenantUser('mg', { employeeCode: 'MG-301', isActive: false }), '2580')
    const inactive = await floorClient(request(app).post('/api/auth/pin-login')).send({ employee: 'MG-301', pin: '2580' })
    expect(inactive.status).toBe(401)
    expect(inactive.body.token).toBeUndefined()

    await withPin(await createTenantUser('mg', { employeeCode: 'MG-302' }), '2580')
    await withPin(await createTenantUser('mg', { employeeCode: 'MG-302' }), '4826')
    const dup = await floorClient(request(app).post('/api/auth/pin-login')).send({ employee: 'MG-302', pin: '2580' })
    expect(dup.status).toBe(409)
  })

  test('only the MG Floor app on the MG tenant can use PIN login', async () => {
    await withPin(await createTenantUser('mg', { employeeCode: 'MG-400' }), '2580')
    const web = await request(app).post('/api/auth/pin-login').set('Host', HOST).set('x-tenant', 'mg').send({ employee: 'MG-400', pin: '2580' })
    expect(web.status).toBe(400)

    await withPin(await createTenantUser('cg', { employeeCode: 'CG-1' }), '2580')
    const cg = await request(app).post('/api/auth/pin-login').set('Host', HOST).set('x-tenant', 'cg').set('X-Client', 'mg-floor').send({ employee: 'CG-1', pin: '2580' })
    expect(cg.status).toBe(404)
  })
})

describe('admin sets / resets / clears the floor PIN', () => {
  test('create with PIN, reset, then clear; weak PINs are refused', async () => {
    const admin = await createTenantUser('mg', { role: 'super_admin', floorDepartment: '' })
    const headers = { Host: HOST, 'x-tenant': 'mg', ...bearer(admin) }

    const weak = await request(app).post('/api/auth/users').set(headers).send({ name: 'Pin Weak', password: 'Password123!', floorPin: '1234' })
    expect(weak.status).toBe(400)

    const created = await request(app).post('/api/auth/users').set(headers)
      .send({ name: 'Pin Worker', password: 'Password123!', role: 'department_user', department: 'production', employeeCode: 'MG-500', floorPin: '2580' })
    expect(created.status).toBe(201)
    expect(created.body.user.floorPinSetAt).toBeTruthy()
    expect(created.body.user.floorPinHash).toBeUndefined()
    const id = created.body.user._id

    const login1 = await floorClient(request(app).post('/api/auth/pin-login')).send({ employee: 'MG-500', pin: '2580' })
    expect(login1.status).toBe(200)

    const reset = await request(app).put(`/api/auth/users/${id}/role`).set(headers)
      .send({ role: 'department_user', department: 'production', employeeCode: 'MG-500', floorPin: '4826' })
    expect(reset.status).toBe(200)
    expect((await floorClient(request(app).post('/api/auth/pin-login')).send({ employee: 'MG-500', pin: '2580' })).status).toBe(401)
    expect((await floorClient(request(app).post('/api/auth/pin-login')).send({ employee: 'MG-500', pin: '4826' })).status).toBe(200)

    const list = await request(app).get('/api/auth/users').set(headers)
    const row = list.body.users.find((u) => u._id === id)
    expect(row.floorPinSetAt).toBeTruthy()
    expect(row.floorPinHash).toBeUndefined()

    const cleared = await request(app).put(`/api/auth/users/${id}/role`).set(headers)
      .send({ role: 'department_user', department: 'production', employeeCode: 'MG-500', clearFloorPin: true })
    expect(cleared.status).toBe(200)
    expect(cleared.body.user.floorPinSetAt).toBeNull()
    const after = await floorClient(request(app).post('/api/auth/pin-login')).send({ employee: 'MG-500', pin: '4826' })
    expect(after.status).toBe(401)
    expect(after.body.code).toBe('NO_FLOOR_PIN')
  })

  test('editing a user without floorPin keeps the existing PIN', async () => {
    const admin = await createTenantUser('mg', { role: 'super_admin', floorDepartment: '' })
    const worker = await withPin(await createTenantUser('mg', { employeeCode: 'MG-501' }), '2580')
    const res = await request(app).put(`/api/auth/users/${worker._id}/role`).set({ Host: HOST, 'x-tenant': 'mg', ...bearer(admin) })
      .send({ role: 'department_user', department: 'production', employeeCode: 'MG-501', title: 'Melter' })
    expect(res.status).toBe(200)
    expect((await floorClient(request(app).post('/api/auth/pin-login')).send({ employee: 'MG-501', pin: '2580' })).status).toBe(200)
  })
})

describe('POST /api/mg-floor/me/pin', () => {
  test('employee sets and changes their own PIN with their password', async () => {
    const user = await createTenantUser('mg', { employeeCode: 'MG-600' })
    const set = (body) => floorClient(request(app).post('/api/mg-floor/me/pin')).set(bearer(user)).send(body)

    const wrong = await set({ password: 'nope', pin: '2580' })
    expect(wrong.status).toBe(401)
    expect(wrong.body.code).toBe('WRONG_PASSWORD')

    expect((await set({ password: 'password123', pin: '1111' })).status).toBe(400)

    const ok = await set({ password: 'password123', pin: '2580' })
    expect(ok.status).toBe(200)
    expect(ok.body.hasFloorPin).toBe(true)
    expect((await floorClient(request(app).post('/api/auth/pin-login')).send({ employee: 'MG-600', pin: '2580' })).status).toBe(200)

    expect((await set({ password: 'password123', pin: '4826' })).status).toBe(200)
    expect((await floorClient(request(app).post('/api/auth/pin-login')).send({ employee: 'MG-600', pin: '2580' })).status).toBe(401)

    const me = await floorClient(request(app).get('/api/auth/me')).set(bearer(user))
    expect(me.body.user.hasFloorPin).toBe(true)
  })

  test('setting a PIN does not log the employee out of other devices', async () => {
    const user = await createTenantUser('mg')
    const token = tokenFor(user, 'mg')
    await new Promise((r) => setTimeout(r, 1100))
    await floorClient(request(app).post('/api/mg-floor/me/pin')).set('Authorization', `Bearer ${token}`).send({ password: 'password123', pin: '2580' })
    const me = await floorClient(request(app).get('/api/auth/me')).set('Authorization', `Bearer ${token}`)
    expect(me.status).toBe(200)
  })
})

describe('tablet attendance', () => {
  test('operators record login and logout; a second login while open reuses the row', async () => {
    const op = await createTenantUser('mg', { employeeCode: 'MG-700' })
    const call = (path, body = {}) => floorClient(request(app).post(`/api/mg-floor/attendance/${path}`)).set(bearer(op)).send(body)

    const first = await call('login', { loginMethod: 'pin', deviceLabel: 'Melting tablet' })
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
    expect(rows[0].loginMethod).toBe('pin')
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
})
