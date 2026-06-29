const express = require('express')
const request = require('supertest')

let mockDb
let connectTenant

jest.mock('../db/tenantConnections', () => ({
  connectTenant: jest.fn(async () => ({ db: mockDb })),
}))

jest.mock('../middleware/auth', () => ({
  protect: (req, _res, next) => {
    req.user = { _id: 'user-1', role: 'super_admin' }
    req.tenant = 'loopc'
    next()
  },
  restrictTo: () => (_req, _res, next) => next(),
}))

jest.mock('../services/vendorRegistryMaintenance', () => ({
  planVendorRegistryMaintenance: jest.fn(async () => ({
    blockedRemovals: [],
    removablePlaceholders: [],
    purgeCandidates: [],
  })),
  applyVendorRegistryMaintenance: jest.fn(async () => ({ removed: 0 })),
}))

function createMockDb() {
  return { collection: () => ({ find: () => ({ toArray: async () => [] }) }) }
}

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/admin', require('../routes/cleanupRoutes'))
  return app
}

let app

beforeEach(() => {
  jest.resetModules()
  ;({ connectTenant } = require('../db/tenantConnections'))
  connectTenant.mockClear()
  app = createApp()
  process.env.NODE_ENV = 'test'
  delete process.env.ENABLE_ADMIN_CLEANUP_API
  delete process.env.CLEANUP_CONFIRM_TOKEN
  mockDb = createMockDb()
})

afterEach(() => {
  process.env.NODE_ENV = 'test'
  delete process.env.ENABLE_ADMIN_CLEANUP_API
  delete process.env.CLEANUP_CONFIRM_TOKEN
})

describe('admin cleanup routes', () => {
  test('blocks cleanup API in production unless explicitly enabled', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ENABLE_ADMIN_CLEANUP_API = 'false'

    const res = await request(app)
      .post('/api/admin/maintenance/vendor-registry')
      .send({})

    expect(res.status).toBe(403)
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/disabled in production/i)
  })

  test('requires confirmation token when configured', async () => {
    process.env.CLEANUP_CONFIRM_TOKEN = 'confirm-cleanup'

    const res = await request(app)
      .post('/api/admin/maintenance/vendor-registry')
      .send({})

    expect(res.status).toBe(403)
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/confirmation token/i)
  })

  test('vendor registry dry-run returns plan when safeguards pass', async () => {
    process.env.CLEANUP_CONFIRM_TOKEN = 'confirm-cleanup'

    const res = await request(app)
      .post('/api/admin/maintenance/vendor-registry')
      .set('x-cleanup-token', 'confirm-cleanup')
      .send({ dryRun: true })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.mode).toBe('dry_run')
    expect(connectTenant).toHaveBeenCalledWith('loopc')
  })
})
