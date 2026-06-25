const request = require('supertest')
const mongoose = require('mongoose')
const {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')
const { setPrimaryMongoReady } = require('../services/readiness')

const createApp = require('../app')
const MetalRate = require('../models/MetalRate')

jest.setTimeout(120000)

const BRIDGE_TOKEN = 'bridge-integration-test-token'
const BRIDGE_PAYLOAD = {
  source: 'mt4-bridge',
  tenant: 'mg',
  currency: 'USD',
  unit: 'TOZ',
  metals: {
    gold: { bid: 3310, ask: 3312 },
    silver: { bid: 36, ask: 36.2 },
    platinum: { bid: 1290, ask: 1292 },
  },
}

let mongo
let app

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.METAL_RATES_BRIDGE_TOKEN = BRIDGE_TOKEN
  process.env.METAL_RATES_BRIDGE_FANOUT_TENANTS = 'all'
  process.env.RATE_LIMIT_MAX = '100000'

  mongo = await startMongoMemoryServer()
  const mongoUri = mongo.getUri()
  process.env.MONGO_URI = mongoUri
  process.env.MONGO_URI_MG = mongoUri
  process.env.MONGO_URI_CG = mongoUri
  process.env.MONGO_URI_LOOPC = mongoUri

  await mongoose.connect(mongoUri, { maxPoolSize: 1 })
  const registry = require('../db/tenantModelRegistry')
  registry.registerAllOnConnection(mongoose.connection)
  setPrimaryMongoReady(true)
  app = createApp()
})

afterEach(async () => {
  if (!isMongooseConnected(mongoose)) return
  for (const tenant of ['mg', 'cg', 'loopc']) {
    const Model = await MetalRate.getTenantModel(tenant)
    await Model.deleteMany({})
  }
})

afterAll(async () => {
  setPrimaryMongoReady(false)
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('POST /api/erp-accounting/metal-rates/bridge', () => {
  test('fans out normalized rates to mg, cg, and loopc', async () => {
    const res = await request(app)
      .post('/api/erp-accounting/metal-rates/bridge')
      .set('x-metal-rates-bridge-token', BRIDGE_TOKEN)
      .set('x-tenant', 'mg')
      .send(BRIDGE_PAYLOAD)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.tenant).toBe('mg')
    expect(res.body.fanout).toEqual(expect.arrayContaining(['mg', 'cg', 'loopc']))
    expect(res.body.rates.source).toBe('mt4-bridge')
    expect(res.body.rates.sourceGoldPrice).toBeGreaterThan(0)

    for (const tenant of ['mg', 'cg', 'loopc']) {
      const Model = await MetalRate.getTenantModel(tenant)
      const doc = await Model.findOne({ source: 'mt4-bridge' })
      expect(doc).toBeTruthy()
      expect(doc.goldPrice).toBeGreaterThan(0)
      expect(doc.silverPrice).toBeGreaterThan(0)
      expect(doc.platinumPrice).toBeGreaterThan(0)
    }
  })

  test('rejects invalid bridge token', async () => {
    const res = await request(app)
      .post('/api/erp-accounting/metal-rates/bridge')
      .set('x-metal-rates-bridge-token', 'wrong-token')
      .set('x-tenant', 'mg')
      .send(BRIDGE_PAYLOAD)

    expect(res.status).toBe(401)
  })
})
