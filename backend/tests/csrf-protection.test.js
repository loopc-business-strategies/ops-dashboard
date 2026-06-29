const request = require('supertest')
const mongoose = require('mongoose')
const {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')

process.env.NODE_ENV = 'test'

const createApp = require('../app')
const User = require('../models/User')

let mongo
let app

const createTenantUser = async (tenant, overrides = {}) => {
  const TenantUser = await User.getTenantModel(tenant)
  const now = Date.now().toString(36)
  return TenantUser.create({
    name: `${tenant}-csrf-${now}-${Math.random().toString(36).slice(2, 8)}`,
    email: `${tenant}-csrf-${now}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: 'password123',
    role: 'super_admin',
    department: '',
    ...overrides,
  })
}

const readCookieValue = (setCookieHeaders = [], key) => {
  for (const line of setCookieHeaders) {
    const head = String(line || '').split(';')[0]
    if (head.startsWith(`${key}=`)) {
      return decodeURIComponent(head.slice(`${key}=`.length))
    }
  }
  return ''
}

const readTenantCookieValue = (setCookieHeaders = [], tenant, baseName) => {
  const named = readCookieValue(setCookieHeaders, `${baseName}_${tenant}`)
  if (named) return named
  return readCookieValue(setCookieHeaders, baseName)
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.RATE_LIMIT_MAX = '100000'
  process.env.AUTH_RATE_LIMIT_MAX = '100000'
  process.env.DEFAULT_TENANT = 'loopc'

  mongo = await startMongoMemoryServer()
  const mongoUri = mongo.getUri()
  process.env.MONGO_URI = mongoUri
  process.env.MONGO_URI_LOOPC = mongoUri
  process.env.MONGO_URI_MG = mongoUri
  process.env.MONGO_URI_CG = mongoUri

  await mongoose.connect(mongoUri)
  app = createApp()
})

afterEach(async () => {
  if (!isMongooseConnected(mongoose)) return
  await Promise.all([
    (await User.getTenantModel('loopc')).deleteMany({}),
    (await User.getTenantModel('mg')).deleteMany({}),
    (await User.getTenantModel('cg')).deleteMany({}),
  ])
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('CSRF protection for cookie-auth mutating routes', () => {
  test('rejects mutating request without CSRF header and accepts with matching header', async () => {
    const user = await createTenantUser('loopc')
    const agent = request.agent(app)

    const login = await agent
      .post('/api/auth/login')
      .send({ company: 'loopc', name: user.name, password: 'password123' })

    expect(login.status).toBe(200)

    const csrfToken = readTenantCookieValue(login.headers['set-cookie'] || [], 'loopc', 'csrfToken')
    expect(csrfToken).toBeTruthy()

    const blocked = await agent.post('/api/auth/refresh').send({})
    expect(blocked.status).toBe(403)
    expect(String(blocked.body.message || '')).toMatch(/csrf validation failed/i)

    const allowed = await agent
      .post('/api/auth/refresh')
      .set('x-csrf-token', csrfToken)
      .send({})

    expect(allowed.status).toBe(200)
    expect(allowed.body.success).toBe(true)
  })

  test('POST /api/auth/refresh returns csrfToken matching new Set-Cookie', async () => {
    const user = await createTenantUser('loopc')
    const agent = request.agent(app)

    const login = await agent
      .post('/api/auth/login')
      .send({ company: 'loopc', name: user.name, password: 'password123' })

    expect(login.status).toBe(200)
    const csrfBefore = readTenantCookieValue(login.headers['set-cookie'] || [], 'loopc', 'csrfToken')
    expect(csrfBefore).toBeTruthy()

    const refresh = await agent
      .post('/api/auth/refresh')
      .set('x-csrf-token', csrfBefore)
      .send({})

    expect(refresh.status).toBe(200)
    expect(refresh.body.csrfToken).toBeTruthy()
    expect(refresh.body.csrfToken).not.toBe(csrfBefore)

    const csrfAfter = readTenantCookieValue(refresh.headers['set-cookie'] || [], 'loopc', 'csrfToken')
    expect(csrfAfter).toBe(refresh.body.csrfToken)
  })

  test('accepts alternate x-xsrf-token header alias', async () => {
    const user = await createTenantUser('loopc')
    const agent = request.agent(app)

    const login = await agent
      .post('/api/auth/login')
      .send({ company: 'loopc', name: user.name, password: 'password123' })

    expect(login.status).toBe(200)

    const csrfToken = readTenantCookieValue(login.headers['set-cookie'] || [], 'loopc', 'csrfToken')
    expect(csrfToken).toBeTruthy()

    const allowed = await agent
      .post('/api/auth/refresh')
      .set('x-xsrf-token', csrfToken)
      .send({})

    expect(allowed.status).toBe(200)
    expect(allowed.body.success).toBe(true)
  })

  test('bypasses CSRF check for setup path', async () => {
    const previousEnable = process.env.ENABLE_SETUP
    process.env.ENABLE_SETUP = 'true'
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ company: 'loopc', name: 'SetupAdmin', password: 'ValidPass1!' })

    if (previousEnable === undefined) delete process.env.ENABLE_SETUP
    else process.env.ENABLE_SETUP = previousEnable

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
  })

  test('mobile login does not set sessionToken cookie (Bearer-only clients)', async () => {
    const user = await createTenantUser('loopc')
    const login = await request(app)
      .post('/api/auth/login')
      .set('X-Client', 'mobile')
      .set('x-tenant', 'loopc')
      .send({ company: 'loopc', name: user.name, password: 'password123' })

    expect(login.status).toBe(200)
    expect(login.body.token).toBeTruthy()
    const setCookie = login.headers['set-cookie'] || []
    const joined = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie)
    expect(joined).not.toMatch(/sessionToken(?:_|=)/)
  })

  test('mobile refresh returns bearer token without session cookie', async () => {
    const user = await createTenantUser('loopc')
    const login = await request(app)
      .post('/api/auth/login')
      .set('X-Client', 'mobile')
      .set('x-tenant', 'loopc')
      .send({ company: 'loopc', name: user.name, password: 'password123' })

    expect(login.status).toBe(200)
    const bearer = login.body.token
    expect(bearer).toBeTruthy()

    const refresh = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${bearer}`)
      .set('X-Client', 'mobile')
      .set('x-tenant', 'loopc')
      .send({})

    expect(refresh.status).toBe(200)
    expect(refresh.body.success).toBe(true)
    expect(refresh.body.token).toBeTruthy()
    expect(refresh.body.expiresIn).toBeTruthy()
    const setCookie = refresh.headers['set-cookie'] || []
    const joined = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie)
    expect(joined).not.toMatch(/sessionToken(?:_|=)/)
  })

  test('GET /api/auth/me reuses existing csrf cookie instead of rotating each request', async () => {
    const user = await createTenantUser('loopc')
    const agent = request.agent(app)

    const login = await agent
      .post('/api/auth/login')
      .send({ company: 'loopc', name: user.name, password: 'password123' })

    expect(login.status).toBe(200)
    const csrfAfterLogin = readTenantCookieValue(login.headers['set-cookie'] || [], 'loopc', 'csrfToken')
    expect(csrfAfterLogin).toBeTruthy()

    const me1 = await agent.get('/api/auth/me').send()
    expect(me1.status).toBe(200)
    expect(me1.body.csrfToken).toBe(csrfAfterLogin)

    const me2 = await agent.get('/api/auth/me').send()
    expect(me2.status).toBe(200)
    expect(me2.body.csrfToken).toBe(csrfAfterLogin)
  })

  test('mutating request skips CSRF when Authorization Bearer is present', async () => {
    const user = await createTenantUser('loopc')
    const agent = request.agent(app)

    const login = await agent
      .post('/api/auth/login')
      .send({ company: 'loopc', name: user.name, password: 'password123' })

    expect(login.status).toBe(200)
    const sessionJwt = readTenantCookieValue(login.headers['set-cookie'] || [], 'loopc', 'sessionToken')
    expect(sessionJwt).toBeTruthy()

    const allowed = await agent
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${sessionJwt}`)
      .send({})

    expect(allowed.status).toBe(200)
    expect(allowed.body.success).toBe(true)
  })
})
