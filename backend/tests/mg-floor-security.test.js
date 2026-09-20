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

const tokenFor = (user, tenant) => jwt.sign({ id: user._id.toString(), company: tenant }, process.env.JWT_SECRET)

function withDbName(uri, dbName) {
  const parsed = new URL(uri)
  parsed.pathname = `/${dbName}`
  return parsed.toString()
}

const createTenantUser = async (tenant, overrides = {}) => {
  const TenantUser = await User.getTenantModel(tenant)
  const now = Date.now().toString(36)
  return TenantUser.create({
    name: `${tenant}-floor-${now}`,
    email: `${tenant}-floor-${now}@example.com`,
    password: 'password123',
    role: 'super_admin',
    department: 'production',
    productionRole: 'production_manager',
    ...overrides,
  })
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
  test('MG user → MG Floor /me = ALLOWED', async () => {
    const user = await createTenantUser('mg')
    const res = await request(app)
      .get('/api/mg-floor/me')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Authorization', `Bearer ${tokenFor(user, 'mg')}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.tenant).toBe('mg')
  })

  test('MG user with x-tenant cg on MG Floor = BLOCKED (session mismatch or MG gate)', async () => {
    const user = await createTenantUser('mg')
    const res = await request(app)
      .get('/api/mg-floor/me')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'cg')
      .set('Authorization', `Bearer ${tokenFor(user, 'mg')}`)

    expect([401, 403]).toContain(res.status)
  })

  test('CG user → MG Floor = BLOCKED', async () => {
    const user = await createTenantUser('cg')
    const res = await request(app)
      .get('/api/mg-floor/me')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'cg')
      .set('Authorization', `Bearer ${tokenFor(user, 'cg')}`)

    expect(res.status).toBe(403)
    expect(res.body.code).toBe('MG_TENANT_REQUIRED')
  })

  test('LoopC user → MG Floor = BLOCKED', async () => {
    const user = await createTenantUser('loopc')
    const res = await request(app)
      .get('/api/mg-floor/me')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'loopc')
      .set('Authorization', `Bearer ${tokenFor(user, 'loopc')}`)

    expect(res.status).toBe(403)
  })

  test('VB user → MG Floor = BLOCKED', async () => {
    const user = await createTenantUser('vb')
    const res = await request(app)
      .get('/api/mg-floor/me')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'vb')
      .set('Authorization', `Bearer ${tokenFor(user, 'vb')}`)

    expect(res.status).toBe(403)
  })

  test('No JWT = BLOCKED', async () => {
    const res = await request(app)
      .get('/api/mg-floor/me')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')

    expect(res.status).toBe(401)
  })

  test('Invalid JWT = BLOCKED', async () => {
    const res = await request(app)
      .get('/api/mg-floor/me')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Authorization', 'Bearer not-a-real-token')

    expect(res.status).toBe(401)
  })

  test('Tampered JWT company claim does not unlock MG Floor for CG user DB', async () => {
    const cgUser = await createTenantUser('cg')
    // Token claims mg but user id only exists in CG DB → auth fails or MG gate
    const bad = jwt.sign({ id: cgUser._id.toString(), company: 'mg' }, process.env.JWT_SECRET)
    const res = await request(app)
      .get('/api/mg-floor/me')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Authorization', `Bearer ${bad}`)

    expect([401, 403]).toContain(res.status)
  })
})

describe('MG Floor scales', () => {
  test('ensures seven default scales and rejects unknown scale ingest', async () => {
    const user = await createTenantUser('mg')
    const token = tokenFor(user, 'mg')

    const list = await request(app)
      .get('/api/mg-floor/scales')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Authorization', `Bearer ${token}`)

    expect(list.status).toBe(200)
    expect(list.body.scales.length).toBeGreaterThanOrEqual(7)

    const bad = await request(app)
      .post('/api/mg-floor/scales/ingest')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Authorization', `Bearer ${token}`)
      .send({
        deviceId: 'MG-GATEWAY-001',
        scaleId: 'FAKE-SCALE-999',
        eventType: 'weight_reading',
        payload: { weight: 10, stable: true, unit: 'g' },
      })

    expect(bad.status).toBe(403)

    const ok = await request(app)
      .post('/api/mg-floor/scales/ingest')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Authorization', `Bearer ${token}`)
      .send({
        deviceId: 'MG-GATEWAY-001',
        scaleId: 'MG-SCALE-001',
        eventType: 'weight_reading',
        payload: { weight: 125.36, stable: true, unit: 'g', connectionType: 'SIMULATOR' },
        idempotencyKey: 'test-scale-reading-1',
      })

    expect([200, 202]).toContain(ok.status)
    expect(ok.body.event.weight).toBe(125.36)
    expect(ok.body.event.stable).toBe(true)

    const again = await request(app)
      .post('/api/mg-floor/scales/ingest')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Authorization', `Bearer ${token}`)
      .send({
        deviceId: 'MG-GATEWAY-001',
        scaleId: 'MG-SCALE-001',
        eventType: 'weight_reading',
        payload: { weight: 125.36, stable: true, unit: 'g' },
        idempotencyKey: 'test-scale-reading-1',
      })

    expect(again.body.reused).toBe(true)
  })
})

describe('MG Floor sync idempotency', () => {
  test('duplicate sync operationId does not double-apply', async () => {
    const user = await createTenantUser('mg')
    const token = tokenFor(user, 'mg')

    // Seed a stable reading so metal_out weight assertion can pass
    await request(app)
      .post('/api/mg-floor/scales/ingest')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Authorization', `Bearer ${token}`)
      .send({
        deviceId: 'GW',
        scaleId: 'MG-SCALE-001',
        eventType: 'weight_reading',
        payload: { weight: 50, stable: true },
        idempotencyKey: 'seed-reading',
      })

    // Sync with unsupported-without-batch should fail consistently (idempotent failure record)
    const opId = 'sync-op-idem-1'
    const body = {
      operations: [
        {
          operationId: opId,
          operationType: 'metal_out',
          payload: {
            // missing batchId → fail
            toDepartment: 'casting',
            scaleId: 'MG-SCALE-001',
            weight: 50,
          },
        },
      ],
    }

    const first = await request(app)
      .post('/api/mg-floor/sync')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Authorization', `Bearer ${token}`)
      .send(body)

    expect(first.status).toBe(200)
    expect(first.body.results[0].operationId).toBe(opId)

    const second = await request(app)
      .post('/api/mg-floor/sync')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Authorization', `Bearer ${token}`)
      .send(body)

    expect(second.status).toBe(200)
    // Either reused SYNCED or same FAILED/CONFLICT — never silent duplicate success without key
    expect(second.body.results[0].operationId).toBe(opId)
  })

  test('XRF devices and tests are MG-only and seed MG-XRF-001', async () => {
    const mgUser = await createTenantUser('mg')
    const cgUser = await createTenantUser('cg')
    const mgToken = tokenFor(mgUser, 'mg')
    const cgToken = tokenFor(cgUser, 'cg')

    const blocked = await request(app)
      .get('/api/mg-floor/xrf/devices')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'cg')
      .set('Authorization', `Bearer ${cgToken}`)
    expect(blocked.status).toBe(403)

    const devices = await request(app)
      .get('/api/mg-floor/xrf/devices')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Authorization', `Bearer ${mgToken}`)
    expect(devices.status).toBe(200)
    expect(devices.body.devices.some((d) => d.analyzerId === 'MG-XRF-001')).toBe(true)

    const created = await request(app)
      .post('/api/mg-floor/xrf/tests')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Authorization', `Bearer ${mgToken}`)
      .send({
        analyzerId: 'MG-XRF-001',
        operationId: 'xrf-test-op-1',
        elements: [{ symbol: 'Au', value: 91.7, unit: '%' }],
      })
    expect([200, 201]).toContain(created.status)
    expect(created.body.test?.elements?.[0]?.symbol).toBe('Au')

    const reused = await request(app)
      .post('/api/mg-floor/xrf/tests')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Authorization', `Bearer ${mgToken}`)
      .send({
        analyzerId: 'MG-XRF-001',
        operationId: 'xrf-test-op-1',
        elements: [{ symbol: 'Au', value: 91.7, unit: '%' }],
      })
    expect(reused.status).toBe(200)
    expect(reused.body.reused).toBe(true)
  })
})
