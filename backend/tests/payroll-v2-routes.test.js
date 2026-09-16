const request = require('supertest')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')
const {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')

const createApp = require('../app')
const User = require('../models/User')
const Employee = require('../models/Employee')
const EmployeeSalaryAssignment = require('../models/EmployeeSalaryAssignment')
const PayrollRun = require('../models/PayrollRun')
const Payslip = require('../models/Payslip')

let mongo
let app

const LOOPC = 'loopc'
const OTHER = 'mg'

const tokenFor = (user, tenant = LOOPC) =>
  jwt.sign({ id: user._id.toString(), company: tenant }, process.env.JWT_SECRET)

const createUser = async (overrides = {}) => {
  const now = Date.now().toString(36)
  return User.create({
    name: `user-${now}`,
    email: `user-${now}@example.com`,
    password: 'password123',
    role: 'super_admin',
    department: 'finance',
    ...overrides,
  })
}

const createEmployee = async (tenant, overrides = {}) => {
  const TenantEmployee = await Employee.getTenantModel(tenant)
  const now = Date.now().toString(36)
  return TenantEmployee.create({
    name: `Employee ${now}`,
    idNumber: `ID-${now}`,
    employeeCode: `EMP-${now}`,
    department: 'finance',
    status: 'ACTIVE',
    ...overrides,
  })
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.RATE_LIMIT_MAX = '100000'
  process.env.AUTH_RATE_LIMIT_MAX = '100000'
  process.env.DEFAULT_TENANT = LOOPC

  mongo = await startMongoMemoryServer()
  const mongoUri = mongo.getUri()
  process.env.MONGO_URI = mongoUri
  process.env.MONGO_URI_LOOPC = mongoUri
  process.env.MONGO_URI_MG = mongoUri
  await mongoose.connect(mongoUri)
  app = createApp()
})

afterEach(async () => {
  if (!isMongooseConnected(mongoose)) return
  await User.deleteMany({})
  for (const tenant of [LOOPC, OTHER]) {
    const models = await Promise.all([
      Employee.getTenantModel(tenant),
      EmployeeSalaryAssignment.getTenantModel(tenant),
      PayrollRun.getTenantModel(tenant),
      Payslip.getTenantModel(tenant),
    ])
    await Promise.all(models.map((M) => M.deleteMany({})))
  }
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('structured payroll API', () => {
  test('non-loopc tenant gets 403 on payroll-v2', async () => {
    const user = await createUser({ company: OTHER })
    const token = tokenFor(user, OTHER)
    const res = await request(app)
      .get('/api/finance/payroll-v2/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant', OTHER)
      .set('x-company', OTHER)
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('STRUCTURED_PAYROLL_DISABLED')
  })

  test('full run lifecycle + payslip uniqueness + self-service isolation', async () => {
    const admin = await createUser({ role: 'super_admin', department: 'finance', employeeCode: 'ADMIN-NO' })
    const workerUser = await createUser({
      role: 'department_user',
      department: 'finance',
      employeeCode: 'W-001',
      name: 'Worker User',
    })
    const otherWorker = await createUser({
      role: 'department_user',
      department: 'finance',
      employeeCode: 'W-002',
      name: 'Other Worker',
    })

    const adminToken = tokenFor(admin, LOOPC)
    const workerToken = tokenFor(workerUser, LOOPC)
    const otherToken = tokenFor(otherWorker, LOOPC)

    const emp1 = await createEmployee(LOOPC, { name: 'Worker One', employeeCode: 'W-001', department: 'finance' })
    const emp2 = await createEmployee(LOOPC, { name: 'Worker Two', employeeCode: 'W-002', department: 'finance' })

    // salary assignments
    for (const emp of [emp1, emp2]) {
      const asgRes = await request(app)
        .put(`/api/finance/payroll-v2/employees/${emp._id}/salary-assignment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant', LOOPC)
        .send({
          earnings: [{ code: 'BASIC', label: 'Basic', amount: 1000 }],
          deductions: [{ code: 'TAX', label: 'Tax', amount: 100 }],
          employerContributions: [{ code: 'PF', label: 'PF', amount: 50 }],
        })
      expect(asgRes.status).toBe(200)
      expect(asgRes.body.data.version).toBe(1)
    }

    const createRes = await request(app)
      .post('/api/finance/payroll-v2/runs')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-tenant', LOOPC)
      .send({
        year: 2026,
        month: 4,
        employeeIds: [emp1._id.toString(), emp2._id.toString()],
        idempotencyKey: 'run-2026-04',
      })
    expect(createRes.status).toBe(201)
    const runId = createRes.body.data._id

    const calc = await request(app)
      .post(`/api/finance/payroll-v2/runs/${runId}/calculate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-tenant', LOOPC)
      .send({})
    expect(calc.status).toBe(200)
    expect(calc.body.data.status).toBe('CALCULATED')
    expect(calc.body.data.totals.net).toBe(1800)

    const submit = await request(app)
      .post(`/api/finance/payroll-v2/runs/${runId}/submit-review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-tenant', LOOPC)
    expect(submit.body.data.status).toBe('UNDER_REVIEW')

    const approve = await request(app)
      .post(`/api/finance/payroll-v2/runs/${runId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-tenant', LOOPC)
    expect(approve.body.data.status).toBe('APPROVED')

    const finalize = await request(app)
      .post(`/api/finance/payroll-v2/runs/${runId}/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-tenant', LOOPC)
    expect(finalize.body.data.status).toBe('FINALIZED')

    // Immutable: cannot select employees after finalize
    const bad = await request(app)
      .post(`/api/finance/payroll-v2/runs/${runId}/select-employees`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-tenant', LOOPC)
      .send({ employeeIds: [emp1._id.toString()] })
    expect(bad.status).toBe(409)

    const gen1 = await request(app)
      .post(`/api/finance/payroll-v2/runs/${runId}/generate-payslips`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-tenant', LOOPC)
    expect(gen1.status).toBe(200)
    expect(gen1.body.data.created.length).toBe(2)
    expect(gen1.body.data.created[0].number).toMatch(/^LOPC-PS-2026-04-\d{6}$/)

    // Idempotent generate
    const gen2 = await request(app)
      .post(`/api/finance/payroll-v2/runs/${runId}/generate-payslips`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-tenant', LOOPC)
    expect(gen2.body.data.created.length).toBe(0)
    expect(gen2.body.data.skipped.length).toBe(2)

    // Self-service: worker only sees own slips
    const mine = await request(app)
      .get('/api/finance/payroll-v2/my-payslips')
      .set('Authorization', `Bearer ${workerToken}`)
      .set('x-tenant', LOOPC)
    expect(mine.status).toBe(200)
    expect(mine.body.data.length).toBe(1)
    expect(mine.body.data[0].employeeCode).toBe('W-001')

    const otherMine = await request(app)
      .get('/api/finance/payroll-v2/my-payslips')
      .set('Authorization', `Bearer ${otherToken}`)
      .set('x-tenant', LOOPC)
    expect(otherMine.body.data.length).toBe(1)
    expect(otherMine.body.data[0].employeeCode).toBe('W-002')

    // Employee profile fields accepted
    const upd = await request(app)
      .put(`/api/hr/employees/${emp1._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-tenant', LOOPC)
      .send({ position: 'Analyst', status: 'ACTIVE', email: 'w1@example.com' })
    expect(upd.status).toBe(200)
    expect(upd.body.employee.position).toBe('Analyst')
  })
})

describe('migration script safety', () => {
  test('script source has no destructive ops', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../scripts/payroll-loopc-migration-report.js'),
      'utf8'
    )
    expect(src).not.toMatch(/\.drop\(/)
    expect(src).not.toMatch(/deleteMany\(/)
    expect(src).not.toMatch(/dropDatabase/)
    expect(src).not.toMatch(/truncate/i)
    expect(src).toMatch(/READ-ONLY/)
  })
})
