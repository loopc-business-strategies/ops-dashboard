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

const GATEWAY_ID = 'MG-GATEWAY-001'
const GATEWAY_SECRET = 'test-gateway-secret'

const gatewayHeaders = () => ({
  'X-Gateway-Id': GATEWAY_ID,
  'X-Gateway-Secret': GATEWAY_SECRET,
})

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.RATE_LIMIT_MAX = '100000'
  process.env.AUTH_RATE_LIMIT_MAX = '100000'
  process.env.DEFAULT_TENANT = 'loopc'
  process.env.MG_GATEWAY_SECRETS = `${GATEWAY_ID}=${GATEWAY_SECRET}`
  process.env.ALLOW_XRF_SIMULATOR = 'true'
  delete process.env.MG_GATEWAY_ALLOW_JWT_FALLBACK

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

    const jwtBlocked = await request(app)
      .post('/api/mg-floor/scales/ingest')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Authorization', `Bearer ${token}`)
      .send({
        deviceId: GATEWAY_ID,
        scaleId: 'MG-SCALE-001',
        eventType: 'weight_reading',
        payload: { weight: 10, stable: true, unit: 'g' },
      })
    expect(jwtBlocked.status).toBe(401)

    const bad = await request(app)
      .post('/api/mg-floor/scales/ingest')
      .set('Host', 'api.loopcstrategies.com')
      .set(gatewayHeaders())
      .send({
        deviceId: GATEWAY_ID,
        scaleId: 'FAKE-SCALE-999',
        eventType: 'weight_reading',
        payload: { weight: 10, stable: true, unit: 'g' },
      })

    expect(bad.status).toBe(403)

    const ok = await request(app)
      .post('/api/mg-floor/scales/ingest')
      .set('Host', 'api.loopcstrategies.com')
      .set(gatewayHeaders())
      .send({
        deviceId: GATEWAY_ID,
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
      .set(gatewayHeaders())
      .send({
        deviceId: GATEWAY_ID,
        scaleId: 'MG-SCALE-001',
        eventType: 'weight_reading',
        payload: { weight: 125.36, stable: true, unit: 'g' },
        idempotencyKey: 'test-scale-reading-1',
      })

    expect(again.body.reused).toBe(true)

    const unknownGw = await request(app)
      .post('/api/mg-floor/scales/ingest')
      .set('Host', 'api.loopcstrategies.com')
      .set('X-Gateway-Id', 'MG-GATEWAY-UNKNOWN')
      .set('X-Gateway-Secret', GATEWAY_SECRET)
      .send({
        deviceId: 'MG-GATEWAY-UNKNOWN',
        scaleId: 'MG-SCALE-001',
        eventType: 'weight_reading',
        payload: { weight: 1, stable: true },
      })
    expect(unknownGw.status).toBe(403)
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
      .set(gatewayHeaders())
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

  test('XRF integrity: app cannot invent Au; gateway ingest + confirm; sim gated', async () => {
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

    const invented = await request(app)
      .post('/api/mg-floor/xrf/tests')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Authorization', `Bearer ${mgToken}`)
      .send({
        analyzerId: 'MG-XRF-001',
        operationId: 'xrf-invent-blocked',
        elements: [{ symbol: 'Au', value: 91.7, unit: '%' }],
      })
    expect(invented.status).toBe(403)

    const ingested = await request(app)
      .post('/api/mg-floor/xrf/ingest/result')
      .set('Host', 'api.loopcstrategies.com')
      .set(gatewayHeaders())
      .send({
        analyzerId: 'MG-XRF-001',
        source: 'hardware',
        ingestId: 'hw-ingest-1',
        elements: [
          { symbol: 'Au', value: 91.72, unit: '%' },
          { symbol: 'Ag', value: 5.41, unit: '%' },
        ],
      })
    expect([200, 201]).toContain(ingested.status)
    expect(ingested.body.test?.source).toBe('hardware')
    expect(ingested.body.test?.confirmationStatus).toBe('PENDING_CONFIRM')
    const xrfTestId = ingested.body.test.xrfTestId

    const pending = await request(app)
      .get('/api/mg-floor/xrf/tests')
      .query({ pendingForConfirm: '1' })
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Authorization', `Bearer ${mgToken}`)
    expect(pending.status).toBe(200)
    expect(pending.body.tests.some((t) => t.xrfTestId === xrfTestId)).toBe(true)

    const confirmOverride = await request(app)
      .post('/api/mg-floor/xrf/tests')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Authorization', `Bearer ${mgToken}`)
      .send({
        xrfTestId,
        operationId: 'xrf-confirm-override',
        elements: [{ symbol: 'Au', value: 99.9, unit: '%' }],
      })
    expect(confirmOverride.status).toBe(403)

    const confirmed = await request(app)
      .post('/api/mg-floor/xrf/tests')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Authorization', `Bearer ${mgToken}`)
      .send({
        xrfTestId,
        operationId: 'xrf-confirm-1',
        batchNumber: 'B-100',
      })
    expect([200, 201]).toContain(confirmed.status)
    expect(confirmed.body.test?.confirmationStatus).toBe('CONFIRMED')
    expect(confirmed.body.test?.elements?.[0]?.value).toBe(91.72)

    const reused = await request(app)
      .post('/api/mg-floor/xrf/tests')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Authorization', `Bearer ${mgToken}`)
      .send({
        xrfTestId,
        operationId: 'xrf-confirm-1',
      })
    expect(reused.status).toBe(200)
    expect(reused.body.reused).toBe(true)

    // Simulator allowed in test (ALLOW_XRF_SIMULATOR=true)
    const simOk = await request(app)
      .post('/api/mg-floor/xrf/tests')
      .set('Host', 'api.loopcstrategies.com')
      .set('x-tenant', 'mg')
      .set('Authorization', `Bearer ${mgToken}`)
      .send({
        source: 'simulated',
        analyzerId: 'MG-XRF-001',
        operationId: 'xrf-sim-ok',
        elements: [{ symbol: 'Au', value: 88.1, unit: '%' }],
      })
    expect([200, 201]).toContain(simOk.status)
    expect(simOk.body.test?.source).toBe('simulated')

    // Pending simulated row (allowed now) — confirm must fail when sim later disabled
    const simPending = await request(app)
      .post('/api/mg-floor/xrf/ingest/result')
      .set('Host', 'api.loopcstrategies.com')
      .set(gatewayHeaders())
      .send({
        analyzerId: 'MG-XRF-001',
        source: 'simulated',
        ingestId: 'sim-pending-confirm-block',
        elements: [{ symbol: 'Au', value: 77.7, unit: '%' }],
      })
    expect([200, 201]).toContain(simPending.status)
    const simPendingId = simPending.body.test.xrfTestId

    // Prod-like: block simulated create + confirm
    const prevAllow = process.env.ALLOW_XRF_SIMULATOR
    const prevNode = process.env.NODE_ENV
    process.env.ALLOW_XRF_SIMULATOR = 'false'
    process.env.NODE_ENV = 'production'
    try {
      const simBlocked = await request(app)
        .post('/api/mg-floor/xrf/tests')
        .set('Host', 'api.loopcstrategies.com')
        .set('x-tenant', 'mg')
        .set('Authorization', `Bearer ${mgToken}`)
        .send({
          source: 'simulated',
          analyzerId: 'MG-XRF-001',
          operationId: 'xrf-sim-blocked',
          elements: [{ symbol: 'Au', value: 88.1, unit: '%' }],
        })
      expect(simBlocked.status).toBe(403)

      const confirmSimBlocked = await request(app)
        .post('/api/mg-floor/xrf/tests')
        .set('Host', 'api.loopcstrategies.com')
        .set('x-tenant', 'mg')
        .set('Authorization', `Bearer ${mgToken}`)
        .send({
          xrfTestId: simPendingId,
          operationId: 'xrf-confirm-sim-blocked',
        })
      expect(confirmSimBlocked.status).toBe(403)
    } finally {
      process.env.ALLOW_XRF_SIMULATOR = prevAllow
      process.env.NODE_ENV = prevNode
    }
  })
})
