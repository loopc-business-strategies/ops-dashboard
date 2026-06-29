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
const Employee = require('../models/Employee')

let mongo
let app

const TEST_TENANT = 'loopc'
const tokenFor = (user) => jwt.sign({ id: user._id.toString(), company: TEST_TENANT }, process.env.JWT_SECRET)

const createUser = async (overrides = {}) => {
  const now = Date.now().toString(36)
  const base = {
    name: `user-${now}-${Math.random().toString(36).slice(2, 8)}`,
    email: `user-${now}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: 'password123',
    role: 'department_user',
    department: 'operations',
  }
  return User.create({ ...base, ...overrides })
}

const createEmployee = async (overrides = {}) => {
  const TenantEmployee = await Employee.getTenantModel(TEST_TENANT)
  const now = Date.now().toString(36)
  return TenantEmployee.create({
    name: `Employee ${now}`,
    idNumber: `ID-${now}`,
    employeeCode: `EMP-${now}`,
    department: 'hr',
    ...overrides,
  })
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.RATE_LIMIT_MAX = '100000'
  process.env.AUTH_RATE_LIMIT_MAX = '100000'
  process.env.DEFAULT_TENANT = TEST_TENANT

  mongo = await startMongoMemoryServer()
  const mongoUri = mongo.getUri()
  process.env.MONGO_URI = mongoUri
  process.env.MONGO_URI_LOOPC = mongoUri
  await mongoose.connect(mongoUri)
  app = createApp()
})

afterEach(async () => {
  if (!isMongooseConnected(mongoose)) return
  await Promise.all([
    User.deleteMany({}),
    (async () => {
      const TenantEmployee = await Employee.getTenantModel(TEST_TENANT)
      await TenantEmployee.deleteMany({})
    })(),
  ])
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('HR employees routes', () => {
  test('GET /api/hr/employees requires authentication', async () => {
    const res = await request(app).get('/api/hr/employees')
    expect(res.status).toBe(401)
  })

  test('GET supports pagination metadata', async () => {
    const hrUser = await createUser({ role: 'department_user', department: 'hr' })
    await createEmployee({ department: 'hr' })
    await createEmployee({ department: 'hr' })

    const res = await request(app)
      .get('/api/hr/employees?page=1&limit=1')
      .set('Authorization', `Bearer ${tokenFor(hrUser)}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.page).toBe(1)
    expect(res.body.limit).toBe(1)
    expect(res.body.total).toBeGreaterThanOrEqual(2)
    expect(res.body.employees).toHaveLength(1)
  })

  test('department user cannot update employees', async () => {
    const opsUser = await createUser({ role: 'department_user', department: 'operations' })
    const employee = await createEmployee({ department: 'hr' })

    const res = await request(app)
      .put(`/api/hr/employees/${employee._id.toString()}`)
      .set('Authorization', `Bearer ${tokenFor(opsUser)}`)
      .send({ name: 'Updated Name' })

    expect(res.status).toBe(403)
  })

  test('department user cannot delete employees', async () => {
    const opsUser = await createUser({ role: 'department_user', department: 'operations' })
    const employee = await createEmployee({ department: 'hr' })

    const res = await request(app)
      .delete(`/api/hr/employees/${employee._id.toString()}`)
      .set('Authorization', `Bearer ${tokenFor(opsUser)}`)

    expect(res.status).toBe(403)
  })

  test('hr department user only sees employees in their department', async () => {
    const hrUser = await createUser({ role: 'department_user', department: 'hr' })
    await createEmployee({ department: 'hr', name: 'HR Staff' })
    await createEmployee({ department: 'finance', name: 'Finance Staff', employeeCode: 'EMP-FIN' })

    const res = await request(app)
      .get('/api/hr/employees')
      .set('Authorization', `Bearer ${tokenFor(hrUser)}`)

    expect(res.status).toBe(200)
    expect(res.body.employees.every((row) => /^hr$/i.test(row.department))).toBe(true)
    expect(res.body.employees.some((row) => row.name === 'Finance Staff')).toBe(false)
  })

  test('hr head can update and delete hr employees', async () => {
    const hrHead = await createUser({ role: 'department_head', department: 'hr' })
    const employee = await createEmployee({ department: 'hr', name: 'Before Update' })

    const updateRes = await request(app)
      .put(`/api/hr/employees/${employee._id.toString()}`)
      .set('Authorization', `Bearer ${tokenFor(hrHead)}`)
      .send({ name: 'After Update' })

    expect(updateRes.status).toBe(200)
    expect(updateRes.body.employee.name).toBe('After Update')

    const deleteRes = await request(app)
      .delete(`/api/hr/employees/${employee._id.toString()}`)
      .set('Authorization', `Bearer ${tokenFor(hrHead)}`)

    expect(deleteRes.status).toBe(200)
    expect(deleteRes.body.success).toBe(true)
  })
})
