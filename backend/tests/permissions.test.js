const request = require('supertest')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const { MongoMemoryServer } = require('mongodb-memory-server')

const createApp = require('../app')
const User = require('../models/User')
const Task = require('../models/Task')
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

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.RATE_LIMIT_MAX = '100000'
  process.env.AUTH_RATE_LIMIT_MAX = '100000'
  process.env.DEFAULT_TENANT = TEST_TENANT

  mongo = await MongoMemoryServer.create()
  const mongoUri = mongo.getUri()
  process.env.MONGO_URI = mongoUri
  process.env.MONGO_URI_LOOPC = mongoUri
  await mongoose.connect(mongoUri)
  app = createApp()
})

afterEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Task.deleteMany({}),
    Employee.deleteMany({}),
  ])
})

afterAll(async () => {
  await mongoose.disconnect()
  if (mongo) await mongo.stop()
})

describe('Authorization guards', () => {
  test('department user cannot view currencies', async () => {
    const normal = await createUser({ role: 'department_user', department: 'operations' })

    const res = await request(app)
      .get('/api/erp-accounting/currencies')
      .set('Authorization', `Bearer ${tokenFor(normal)}`)

    expect(res.status).toBe(403)
  })

  test('non-super-admin cannot list users', async () => {
    const normal = await createUser({ role: 'department_user', department: 'operations' })

    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${tokenFor(normal)}`)

    expect(res.status).toBe(403)
  })

  test('super-admin can list users', async () => {
    const admin = await createUser({ role: 'super_admin', department: '' })
    await createUser({ role: 'department_user', department: 'operations' })

    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${tokenFor(admin)}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.users)).toBe(true)
    expect(res.body.users.length).toBeGreaterThan(0)
  })

  test('super-admin can save granular dashboard permissions', async () => {
    const admin = await createUser({ role: 'super_admin', department: '' })
    const target = await createUser({ role: 'management', department: 'management' })

    const res = await request(app)
      .put(`/api/auth/users/${target._id.toString()}/permissions`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send({
        modulePermissions: {
          overview: { on: true },
          'procurement-plus': { on: true },
          erp: {
            on: true,
            subs: {
              transactions: { on: true },
              vendors: { on: true },
            },
          },
        },
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.modulePermissions['procurement-plus'].on).toBe(true)
    expect(res.body.modulePermissions.erp.subs.transactions.on).toBe(true)
  })

  test('department user cannot create employee', async () => {
    const user = await createUser({ role: 'department_user', department: 'operations' })

    const res = await request(app)
      .post('/api/hr/employees')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ name: 'Alice', idNumber: 'ID-1', employeeCode: 'EMP-1', department: 'hr' })

    expect(res.status).toBe(403)
  })

  test('hr department head can create employee', async () => {
    const hrHead = await createUser({ role: 'department_head', department: 'hr' })

    const res = await request(app)
      .post('/api/hr/employees')
      .set('Authorization', `Bearer ${tokenFor(hrHead)}`)
      .send({
        name: 'Bob',
        idNumber: 'ID-2',
        employeeCode: 'EMP-2',
        department: 'hr',
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.employee.department).toBe('hr')
  })

  test('department user can only view allowed tasks', async () => {
    const opsUser = await createUser({ role: 'department_user', department: 'operations' })

    await Task.create({ title: 'Ops task', department: 'operations' })
    await Task.create({ title: 'HR task', department: 'hr' })

    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${tokenFor(opsUser)}`)

    expect(res.status).toBe(200)
    expect(res.body.tasks.length).toBe(1)
    expect(res.body.tasks[0].department).toBe('operations')
  })

  test('management is read-only for task updates', async () => {
    const manager = await createUser({ role: 'management', department: 'management' })
    const task = await Task.create({ title: 'Read only update', department: 'operations' })

    const res = await request(app)
      .put(`/api/tasks/${task._id.toString()}`)
      .set('Authorization', `Bearer ${tokenFor(manager)}`)
      .send({ status: 'done' })

    expect(res.status).toBe(403)
  })

  test('department user cannot update unassigned task', async () => {
    const opsUser = await createUser({ role: 'department_user', department: 'operations', name: 'Ops User' })
    const task = await Task.create({
      title: 'Unassigned task',
      department: 'operations',
      assignedTo: 'Someone Else',
    })

    const res = await request(app)
      .put(`/api/tasks/${task._id.toString()}`)
      .set('Authorization', `Bearer ${tokenFor(opsUser)}`)
      .send({ status: 'done' })

    expect(res.status).toBe(403)
  })

  test('department head task creation is pinned to own department', async () => {
    const head = await createUser({ role: 'department_head', department: 'finance' })

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${tokenFor(head)}`)
      .send({ title: 'Finance action', department: 'hr' })

    expect(res.status).toBe(201)
    expect(res.body.task.department).toBe('finance')
  })
})
