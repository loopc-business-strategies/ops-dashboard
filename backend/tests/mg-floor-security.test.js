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
const createTenantUser = async (tenant, overrides = {}) => {
  const TenantUser = await User.getTenantModel(tenant)
  seq += 1
  const tag = `${Date.now().toString(36)}${seq}`
  return TenantUser.create({
    name: `${tenant}-floor-${tag}`,
    email: `${tenant}-floor-${tag}@example.com`,
    password: 'password123',
    role: 'super_admin',
    department: 'production',
    productionRole: 'production_manager',
    ...overrides,
  })
}

const mgHeaders = (user) => ({
  Host: HOST,
  'x-tenant': 'mg',
  Authorization: `Bearer ${tokenFor(user, 'mg')}`,
})

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
    (await User.getTenantModel('loopc')).deleteMany({}),
    (await User.getTenantModel('mg')).deleteMany({}),
    (await User.getTenantModel('cg')).deleteMany({}),
    (await User.getTenantModel('vb')).deleteMany({}),
  ])
}, 60000)

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
}, 60000)

describe('MG Floor cross-tenant security', () => {
  test('MG user → MG Floor /me = ALLOWED, with floorDepartment and no scale permission', async () => {
    const user = await createTenantUser('mg', { floorDepartment: 'bangle_area' })
    const res = await request(app).get('/api/mg-floor/me').set(mgHeaders(user))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.tenant).toBe('mg')
    expect(res.body.user.floorDepartment).toBe('bangle_area')
    expect(res.body.permissions).not.toHaveProperty('manageScales')
    expect(res.body.permissions.approveBatches).toBe(true)
  })

  test('legacy floor departments are reported as workbook departments (retired ones as unassigned)', async () => {
    const packer = await createTenantUser('mg', { floorDepartment: 'packing' })
    const packerMe = await request(app).get('/api/mg-floor/me').set(mgHeaders(packer))
    expect(packerMe.body.user.floorDepartment).toBe('finished_goods')

    const caster = await createTenantUser('mg', { floorDepartment: 'casting' })
    const casterMe = await request(app).get('/api/mg-floor/me').set(mgHeaders(caster))
    expect(casterMe.body.user.floorDepartment).toBe('')
  })

  test('MG user with x-tenant cg on MG Floor = BLOCKED (session mismatch or MG gate)', async () => {
    const user = await createTenantUser('mg')
    const res = await request(app)
      .get('/api/mg-floor/me')
      .set('Host', HOST)
      .set('x-tenant', 'cg')
      .set('Authorization', `Bearer ${tokenFor(user, 'mg')}`)

    expect([401, 403]).toContain(res.status)
  })

  test('CG user → MG Floor = BLOCKED', async () => {
    const user = await createTenantUser('cg')
    const res = await request(app)
      .get('/api/mg-floor/me')
      .set('Host', HOST)
      .set('x-tenant', 'cg')
      .set('Authorization', `Bearer ${tokenFor(user, 'cg')}`)

    expect(res.status).toBe(403)
    expect(res.body.code).toBe('MG_TENANT_REQUIRED')
  })

  test('LoopC user → MG Floor = BLOCKED', async () => {
    const user = await createTenantUser('loopc')
    const res = await request(app)
      .get('/api/mg-floor/me')
      .set('Host', HOST)
      .set('x-tenant', 'loopc')
      .set('Authorization', `Bearer ${tokenFor(user, 'loopc')}`)

    expect(res.status).toBe(403)
  })

  test('VB user → MG Floor = BLOCKED', async () => {
    const user = await createTenantUser('vb')
    const res = await request(app)
      .get('/api/mg-floor/me')
      .set('Host', HOST)
      .set('x-tenant', 'vb')
      .set('Authorization', `Bearer ${tokenFor(user, 'vb')}`)

    expect(res.status).toBe(403)
  })

  test('No JWT = BLOCKED', async () => {
    const res = await request(app).get('/api/mg-floor/me').set('Host', HOST).set('x-tenant', 'mg')
    expect(res.status).toBe(401)
  })

  test('Invalid JWT = BLOCKED', async () => {
    const res = await request(app)
      .get('/api/mg-floor/me')
      .set('Host', HOST)
      .set('x-tenant', 'mg')
      .set('Authorization', 'Bearer not-a-real-token')

    expect(res.status).toBe(401)
  })

  test('Tampered JWT company claim does not unlock MG Floor for CG user DB', async () => {
    const cgUser = await createTenantUser('cg')
    const bad = jwt.sign({ id: cgUser._id.toString(), company: 'mg' }, process.env.JWT_SECRET)
    const res = await request(app)
      .get('/api/mg-floor/me')
      .set('Host', HOST)
      .set('x-tenant', 'mg')
      .set('Authorization', `Bearer ${bad}`)

    expect([401, 403]).toContain(res.status)
  })
})

describe('MG Floor removed scale / capture / XRF / gateway / legacy metal endpoints', () => {
  const REMOVED = [
    ['get', '/api/mg-floor/scales'],
    ['post', '/api/mg-floor/scales'],
    ['patch', '/api/mg-floor/scales/MG-SCALE-001'],
    ['get', '/api/mg-floor/scales/MG-SCALE-001/status'],
    ['post', '/api/mg-floor/scales/MG-SCALE-001/capture-stable'],
    ['post', '/api/mg-floor/scales/MG-SCALE-001/archive'],
    ['post', '/api/mg-floor/scales/ingest'],
    ['get', '/api/mg-floor/scale-camera-captures'],
    ['post', '/api/mg-floor/scale-camera-captures'],
    ['post', '/api/mg-floor/scale-camera-captures/cap_12345678/photo'],
    ['get', '/api/mg-floor/xrf/devices'],
    ['post', '/api/mg-floor/xrf/tests'],
    ['post', '/api/mg-floor/xrf/ingest'],
    ['get', '/api/mg-floor/gateways'],
    ['post', '/api/mg-floor/gateways'],
    ['get', '/api/mg-floor/gateway/devices'],
    ['post', '/api/mg-floor/metal/in'],
    ['post', '/api/mg-floor/metal/out'],
    ['post', '/api/mg-floor/transfers'],
    ['get', '/api/mg-floor/passes/open'],
  ]

  test.each(REMOVED)('%s %s → 410 MG_FLOOR_FEATURE_REMOVED', async (method, path) => {
    const user = await createTenantUser('mg')
    const res = await request(app)[method](path)
      .set(mgHeaders(user))
      .send({ scaleId: 'MG-SCALE-001', weight: 10, stable: true, passId: 'aaaaaaaaaaaaaaaaaaaaaaaa' })

    expect(res.status).toBe(410)
    expect(res.body).toMatchObject({ success: false, code: 'MG_FLOOR_FEATURE_REMOVED' })
  })

  test('removed endpoints do not accept scale data without auth either', async () => {
    const res = await request(app)
      .post('/api/mg-floor/scales/ingest')
      .set('Host', HOST)
      .set('X-Gateway-Id', 'MG-GATEWAY-001')
      .set('X-Gateway-Secret', 'secret')
      .send({ deviceId: 'MG-GATEWAY-001', scaleId: 'MG-SCALE-001', payload: { weight: 10, stable: true } })
    expect(res.status).toBe(410)
  })

  test('hardware ingest rejects weighing_scale device events', async () => {
    const user = await createTenantUser('mg')
    const res = await request(app)
      .post('/api/hardware/ingest')
      .set(mgHeaders(user))
      .send({ deviceType: 'weighing_scale', deviceId: 'SCALE-1', eventType: 'weight_reading', payload: { grams: 10 } })
    expect(res.status).toBe(400)

    const contract = await request(app).get('/api/hardware/contract').set(mgHeaders(user))
    expect(contract.status).toBe(200)
    expect(contract.body.deviceTypes).not.toContain('weighing_scale')
    expect(contract.body).not.toHaveProperty('mgFloorIngestPath')
  })
})

describe('MG Floor sync idempotency', () => {
  test('duplicate sync operationId does not double-apply a batch entry', async () => {
    const user = await createTenantUser('mg', { floorDepartment: 'melting' })
    const entryId = 'be_sync_idem_00000001'
    const body = {
      operations: [
        {
          operationId: `be_${entryId}`,
          operationType: 'batch_entry',
          payload: {
            entryId,
            direction: 'IN',
            batchLabel: '1',
            entryDate: '2026-09-28',
            lines: [{ metal: 'Gold', qty: 12.5, purity: 99.5, time: '09:00' }],
          },
        },
      ],
    }

    const first = await request(app).post('/api/mg-floor/sync').set(mgHeaders(user)).send(body)
    expect(first.status).toBe(200)
    expect(first.body.results[0]).toMatchObject({ operationId: `be_${entryId}`, syncStatus: 'SYNCED' })

    const second = await request(app).post('/api/mg-floor/sync').set(mgHeaders(user)).send(body)
    expect(second.status).toBe(200)
    expect(second.body.results[0]).toMatchObject({ syncStatus: 'SYNCED', reused: true })

    const FloorBatchEntry = await require('../models/FloorBatchEntry').getTenantModel('mg')
    expect(await FloorBatchEntry.countDocuments({ entryId })).toBe(1)
    await FloorBatchEntry.deleteMany({})
  })
})

describe('User.floorDepartment admin assignment', () => {
  test('super admin sets a valid floor department; unknown values are rejected', async () => {
    const admin = await createTenantUser('mg')
    const created = await request(app)
      .post('/api/auth/users')
      .set(mgHeaders(admin))
      .send({ name: `op-${Date.now().toString(36)}`, password: 'Password123!', role: 'department_user', department: 'production', floorDepartment: 'rolling' })
    expect(created.status).toBe(201)
    expect(created.body.user.floorDepartment).toBe('rolling')

    const id = created.body.user._id
    const badCreate = await request(app)
      .post('/api/auth/users')
      .set(mgHeaders(admin))
      .send({ name: `op2-${Date.now().toString(36)}`, password: 'Password123!', floorDepartment: 'vault' })
    expect(badCreate.status).toBe(400)

    const updated = await request(app)
      .put(`/api/auth/users/${id}/role`)
      .set(mgHeaders(admin))
      .send({ role: 'department_user', department: 'production', floorDepartment: 'stamping' })
    expect(updated.status).toBe(200)
    expect(updated.body.user.floorDepartment).toBe('stamping')

    const kept = await request(app)
      .put(`/api/auth/users/${id}/role`)
      .set(mgHeaders(admin))
      .send({ role: 'department_user', department: 'production' })
    expect(kept.status).toBe(200)
    expect(kept.body.user.floorDepartment).toBe('stamping')

    const badUpdate = await request(app)
      .put(`/api/auth/users/${id}/role`)
      .set(mgHeaders(admin))
      .send({ role: 'department_user', floorDepartment: 'somewhere' })
    expect(badUpdate.status).toBe(400)

    const retired = await request(app)
      .put(`/api/auth/users/${id}/role`)
      .set(mgHeaders(admin))
      .send({ role: 'department_user', floorDepartment: 'casting' })
    expect(retired.status).toBe(400)
  })

  test('operators cannot assign their own floor department', async () => {
    const op = await createTenantUser('mg', { role: 'department_user', productionRole: 'operator', floorDepartment: 'melting' })
    const res = await request(app)
      .put(`/api/auth/users/${op._id}/role`)
      .set(mgHeaders(op))
      .send({ role: 'department_user', floorDepartment: 'rolling' })
    expect(res.status).toBe(403)
  })
})

describe('MG Floor stats and floor alerts', () => {
  test('stats/summary requires auth and returns buckets', async () => {
    const denied = await request(app).get('/api/mg-floor/stats/summary').set('Host', HOST).set('x-tenant', 'mg')
    expect(denied.status).toBe(401)

    const user = await createTenantUser('mg')
    const ok = await request(app).get('/api/mg-floor/stats/summary').set(mgHeaders(user))
    expect(ok.status).toBe(200)
    expect(ok.body.metalIn).toBeTruthy()
    expect(ok.body.metalOut).toBeTruthy()
  })

  test('floor alert requires auth; CG tenant blocked', async () => {
    const mgUser = await createTenantUser('mg')
    const cgUser = await createTenantUser('cg')

    const noAuth = await request(app)
      .post('/api/mg-floor/alerts')
      .set('Host', HOST)
      .set('x-tenant', 'mg')
      .send({ title: 'Need help' })
    expect(noAuth.status).toBe(401)

    const blocked = await request(app)
      .post('/api/mg-floor/alerts')
      .set('Host', HOST)
      .set('x-tenant', 'cg')
      .set('Authorization', `Bearer ${tokenFor(cgUser, 'cg')}`)
      .send({ title: 'Need help' })
    expect(blocked.status).toBe(403)

    const ok = await request(app)
      .post('/api/mg-floor/alerts')
      .set(mgHeaders(mgUser))
      .send({
        title: 'Floor assistance — melting',
        message: 'Operator needs help',
        department: 'melting',
        operationId: 'alert-1',
      })
    expect([200, 201]).toContain(ok.status)
  })
})
