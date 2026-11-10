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
const EmployeeRemark = require('../models/EmployeeRemark')

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
  const TenantEmployee = await Employee.getTenantModel(TEST_TENANT)
  await TenantEmployee.syncIndexes()
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
    (async () => {
      const TenantRemark = await EmployeeRemark.getTenantModel(TEST_TENANT)
      await TenantRemark.deleteMany({})
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

  test('hr department user sees company-wide employees including salaries', async () => {
    const hrUser = await createUser({ role: 'department_user', department: 'hr' })
    await createEmployee({ department: 'hr', name: 'HR Staff', salaryAgreed: 1000 })
    await createEmployee({ department: 'finance', name: 'Finance Staff', employeeCode: 'EMP-FIN', salaryAgreed: 2000 })

    const res = await request(app)
      .get('/api/hr/employees')
      .set('Authorization', `Bearer ${tokenFor(hrUser)}`)

    expect(res.status).toBe(200)
    expect(res.body.employees.some((row) => row.name === 'HR Staff')).toBe(true)
    expect(res.body.employees.some((row) => row.name === 'Finance Staff')).toBe(true)
    const finance = res.body.employees.find((row) => row.name === 'Finance Staff')
    expect(finance.salaryAgreed).toBe(2000)
  })

  test('hr department user can update hr employees', async () => {
    const hrUser = await createUser({ role: 'department_user', department: 'hr' })
    const employee = await createEmployee({ department: 'hr', name: 'HR Before' })

    const res = await request(app)
      .put(`/api/hr/employees/${employee._id.toString()}`)
      .set('Authorization', `Bearer ${tokenFor(hrUser)}`)
      .send({ name: 'HR After' })

    expect(res.status).toBe(200)
    expect(res.body.employee.name).toBe('HR After')
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

  test('create and list round-trip spreadsheet HR fields', async () => {
    const hrHead = await createUser({ role: 'department_head', department: 'hr' })
    const payload = {
      name: 'Spreadsheet Staff',
      idNumber: '8501015009087',
      employeeCode: 'EMP-SHEET-1',
      department: 'hr',
      joiningDate: '2024-03-15',
      salaryAgreed: 25000,
      lastIncrement: '2025-01-01',
      rebate: 500,
    }

    const createRes = await request(app)
      .post('/api/hr/employees')
      .set('Authorization', `Bearer ${tokenFor(hrHead)}`)
      .send(payload)

    expect(createRes.status).toBe(201)
    expect(createRes.body.success).toBe(true)
    expect(createRes.body.employee.name).toBe(payload.name)
    expect(createRes.body.employee.salaryAgreed).toBe(25000)
    expect(createRes.body.employee.rebate).toBe(500)
    expect(String(createRes.body.employee.joiningDate)).toContain('2024-03-15')
    expect(String(createRes.body.employee.lastIncrement)).toContain('2025-01-01')

    const listRes = await request(app)
      .get('/api/hr/employees')
      .set('Authorization', `Bearer ${tokenFor(hrHead)}`)

    expect(listRes.status).toBe(200)
    const row = listRes.body.employees.find((e) => e.employeeCode === 'EMP-SHEET-1')
    expect(row).toBeTruthy()
    expect(row.salaryAgreed).toBe(25000)
    expect(row.rebate).toBe(500)
  })

  test('hr staff can record rebate collection amount and date for any department', async () => {
    const hrUser = await createUser({ role: 'department_user', department: 'hr' })
    const employee = await createEmployee({
      department: 'finance',
      name: 'Finance Rebate Emp',
      employeeCode: 'EMP-REB-1',
      rebate: 400,
    })

    const collectRes = await request(app)
      .patch(`/api/hr/employees/${employee._id.toString()}/rebate-collected`)
      .set('Authorization', `Bearer ${tokenFor(hrUser)}`)
      .send({
        year: 2026,
        month: 11,
        collected: true,
        amount: 250,
        collectedAt: '2026-11-05',
      })

    expect(collectRes.status).toBe(200)
    expect(collectRes.body.success).toBe(true)
    expect(collectRes.body.employee.rebateCollectedMonths).toContain('2026-11')
    const entry = (collectRes.body.employee.rebateCollections || []).find((c) => c.month === '2026-11')
    expect(entry).toBeTruthy()
    expect(entry.amount).toBe(250)
    expect(String(entry.collectedAt)).toContain('2026-11-05')

    const clearRes = await request(app)
      .patch(`/api/hr/employees/${employee._id.toString()}/rebate-collected`)
      .set('Authorization', `Bearer ${tokenFor(hrUser)}`)
      .send({ year: 2026, month: 11, collected: false })

    expect(clearRes.status).toBe(200)
    expect(clearRes.body.employee.rebateCollectedMonths || []).not.toContain('2026-11')
    expect((clearRes.body.employee.rebateCollections || []).some((c) => c.month === '2026-11')).toBe(false)
  })

  test('legacy rebateCollectedMonths without rebateCollections still marks month collected', async () => {
    const hrHead = await createUser({ role: 'department_head', department: 'hr' })
    const employee = await createEmployee({
      department: 'hr',
      name: 'Legacy Rebate Emp',
      employeeCode: 'EMP-REB-LEG',
      rebate: 100,
    })
    const TenantEmployee = await Employee.getTenantModel(TEST_TENANT)
    await TenantEmployee.updateOne(
      { _id: employee._id },
      { $set: { rebateCollectedMonths: ['2026-10'], rebateCollections: [] } },
    )

    const listRes = await request(app)
      .get('/api/hr/employees')
      .set('Authorization', `Bearer ${tokenFor(hrHead)}`)

    expect(listRes.status).toBe(200)
    const row = listRes.body.employees.find((e) => e.employeeCode === 'EMP-REB-LEG')
    expect(row).toBeTruthy()
    expect(row.rebateCollectedMonths).toContain('2026-10')
  })

  test('hr head can append and list employee remarks', async () => {
    const hrHead = await createUser({ role: 'department_head', department: 'hr', name: 'HR Head' })
    const employee = await createEmployee({ department: 'hr', name: 'Remark Target' })

    const createRes = await request(app)
      .post(`/api/hr/employees/${employee._id.toString()}/remarks`)
      .set('Authorization', `Bearer ${tokenFor(hrHead)}`)
      .send({ text: 'Completed probation review' })

    expect(createRes.status).toBe(201)
    expect(createRes.body.success).toBe(true)
    expect(createRes.body.remark.text).toBe('Completed probation review')
    expect(createRes.body.remark.createdByName).toBe('HR Head')
    expect(createRes.body.remark.employeeName).toBe('Remark Target')

    const listRes = await request(app)
      .get(`/api/hr/employees/${employee._id.toString()}/remarks`)
      .set('Authorization', `Bearer ${tokenFor(hrHead)}`)

    expect(listRes.status).toBe(200)
    expect(listRes.body.remarks).toHaveLength(1)
    expect(listRes.body.remarks[0].text).toBe('Completed probation review')
  })

  test('rejects create with duplicate national ID', async () => {
    const hrHead = await createUser({ role: 'department_head', department: 'hr' })
    const first = await request(app)
      .post('/api/hr/employees')
      .set('Authorization', `Bearer ${tokenFor(hrHead)}`)
      .send({
        name: 'First Person',
        idNumber: 'AC-2076035',
        phoneNumber: '+998901111111',
        employeeCode: 'EMP-DUP-ID-1',
        department: 'hr',
      })
    expect(first.status).toBe(201)

    const second = await request(app)
      .post('/api/hr/employees')
      .set('Authorization', `Bearer ${tokenFor(hrHead)}`)
      .send({
        name: 'Other Person',
        idNumber: 'ac 2076035',
        phoneNumber: '+998902222222',
        employeeCode: 'EMP-DUP-ID-2',
        department: 'hr',
      })

    expect(second.status).toBe(409)
    expect(second.body.code).toBe('DUPLICATE_EMPLOYEE')
    expect(second.body.field).toBe('idNumber')
    expect(second.body.message).toMatch(/already registered/i)
    expect(second.body.existingEmployeeId).toBe(String(first.body.employee._id))
  })

  test('rejects create with duplicate phone number', async () => {
    const hrHead = await createUser({ role: 'department_head', department: 'hr' })
    const first = await request(app)
      .post('/api/hr/employees')
      .set('Authorization', `Bearer ${tokenFor(hrHead)}`)
      .send({
        name: 'Phone One',
        idNumber: 'ID-PHONE-1',
        phoneNumber: '+998 90 333-4444',
        employeeCode: 'EMP-DUP-PH-1',
        department: 'hr',
      })
    expect(first.status).toBe(201)

    const second = await request(app)
      .post('/api/hr/employees')
      .set('Authorization', `Bearer ${tokenFor(hrHead)}`)
      .send({
        name: 'Phone Two',
        idNumber: 'ID-PHONE-2',
        phoneNumber: '998903334444',
        employeeCode: 'EMP-DUP-PH-2',
        department: 'hr',
      })

    expect(second.status).toBe(409)
    expect(second.body.code).toBe('DUPLICATE_EMPLOYEE')
    expect(second.body.field).toBe('phoneNumber')
  })

  test('blocks recreating archived identity and supports reactivate', async () => {
    const hrHead = await createUser({ role: 'department_head', department: 'hr' })
    const created = await request(app)
      .post('/api/hr/employees')
      .set('Authorization', `Bearer ${tokenFor(hrHead)}`)
      .send({
        name: 'Soft Delete Target',
        idNumber: 'ID-SOFT-DEL-1',
        phoneNumber: '+998905555555',
        employeeCode: 'EMP-SOFT-1',
        department: 'hr',
      })
    expect(created.status).toBe(201)
    const archivedId = created.body.employee._id

    const deleted = await request(app)
      .delete(`/api/hr/employees/${archivedId}`)
      .set('Authorization', `Bearer ${tokenFor(hrHead)}`)
    expect(deleted.status).toBe(200)

    const recreated = await request(app)
      .post('/api/hr/employees')
      .set('Authorization', `Bearer ${tokenFor(hrHead)}`)
      .send({
        name: 'Rehired Person',
        idNumber: 'ID-SOFT-DEL-1',
        phoneNumber: '+998906666666',
        employeeCode: 'EMP-SOFT-2',
        department: 'hr',
      })
    expect(recreated.status).toBe(409)
    expect(recreated.body.code).toBe('ARCHIVED_EMPLOYEE')
    expect(recreated.body.existingEmployeeId).toBe(String(archivedId))

    const reactivated = await request(app)
      .post(`/api/hr/employees/${archivedId}/reactivate`)
      .set('Authorization', `Bearer ${tokenFor(hrHead)}`)
    expect(reactivated.status).toBe(200)
    expect(reactivated.body.employee.isDeleted).toBe(false)
    expect(reactivated.body.employee.employeeCode).toBe('EMP-SOFT-1')
  })

  test('asOf list includes archived employees employed on that date', async () => {
    const hrHead = await createUser({ role: 'department_head', department: 'hr' })
    const token = tokenFor(hrHead)

    const early = await request(app)
      .post('/api/hr/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Early Hire',
        idNumber: 'ID-ASOF-EARLY',
        phoneNumber: '+998901010101',
        employeeCode: 'EMP-ASOF-1',
        department: 'hr',
        joiningDate: '2026-05-01',
      })
    expect(early.status).toBe(201)

    const late = await request(app)
      .post('/api/hr/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Late Hire',
        idNumber: 'ID-ASOF-LATE',
        phoneNumber: '+998902020202',
        employeeCode: 'EMP-ASOF-2',
        department: 'hr',
        joiningDate: '2026-11-05',
      })
    expect(late.status).toBe(201)

    const may = await request(app)
      .get('/api/hr/employees')
      .query({ asOf: '2026-05-15' })
      .set('Authorization', `Bearer ${token}`)
    expect(may.status).toBe(200)
    const mayNames = (may.body.employees || []).map((e) => e.name)
    expect(mayNames).toContain('Early Hire')
    expect(mayNames).not.toContain('Late Hire')

    await request(app)
      .delete(`/api/hr/employees/${early.body.employee._id}`)
      .set('Authorization', `Bearer ${token}`)

    const TenantEmployee = await Employee.getTenantModel(TEST_TENANT)
    await TenantEmployee.updateOne(
      { _id: early.body.employee._id },
      { $set: { deletedAt: new Date('2026-10-20T12:00:00.000Z'), isDeleted: true } },
    )

    const oct = await request(app)
      .get('/api/hr/employees')
      .query({ asOf: '2026-10-10' })
      .set('Authorization', `Bearer ${token}`)
    expect(oct.status).toBe(200)
    const octNames = (oct.body.employees || []).map((e) => e.name)
    expect(octNames).toContain('Early Hire')

    const nov = await request(app)
      .get('/api/hr/employees')
      .query({ asOf: '2026-11-01' })
      .set('Authorization', `Bearer ${token}`)
    expect(nov.status).toBe(200)
    const novNames = (nov.body.employees || []).map((e) => e.name)
    expect(novNames).not.toContain('Early Hire')
    expect(novNames).not.toContain('Late Hire')
  })

  test('next-code skips archived EMP numbers', async () => {
    const hrHead = await createUser({ role: 'department_head', department: 'hr' })
    const token = tokenFor(hrHead)
    const TenantEmployee = await Employee.getTenantModel(TEST_TENANT)
    await TenantEmployee.create({
      name: 'Archived Three',
      idNumber: 'ID-CODE-3',
      employeeCode: 'EMP-003',
      department: 'hr',
      isDeleted: true,
      deletedAt: new Date('2026-09-01'),
    })
    await TenantEmployee.create({
      name: 'Active Two',
      idNumber: 'ID-CODE-2',
      employeeCode: 'EMP-002',
      department: 'hr',
    })

    const next = await request(app)
      .get('/api/hr/employees/next-code')
      .set('Authorization', `Bearer ${token}`)
    expect(next.status).toBe(200)
    expect(next.body.employeeCode).toBe('EMP-004')

    const created = await request(app)
      .post('/api/hr/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Fresh Hire',
        idNumber: 'ID-CODE-NEW',
        phoneNumber: '+998909090909',
        department: 'hr',
      })
    expect(created.status).toBe(201)
    expect(created.body.employee.employeeCode).toBe('EMP-004')
  })

  test('parallel duplicate creates yield one success and one conflict', async () => {
    const hrHead = await createUser({ role: 'department_head', department: 'hr' })
    const payloadA = {
      name: 'Race A',
      idNumber: 'ID-RACE-001',
      phoneNumber: '+998907777001',
      employeeCode: 'EMP-RACE-A',
      department: 'hr',
    }
    const payloadB = {
      name: 'Race B',
      idNumber: 'ID-RACE-001',
      phoneNumber: '+998907777002',
      employeeCode: 'EMP-RACE-B',
      department: 'hr',
    }

    const [a, b] = await Promise.all([
      request(app).post('/api/hr/employees').set('Authorization', `Bearer ${tokenFor(hrHead)}`).send(payloadA),
      request(app).post('/api/hr/employees').set('Authorization', `Bearer ${tokenFor(hrHead)}`).send(payloadB),
    ])

    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([201, 409])
    const conflict = a.status === 409 ? a : b
    expect(conflict.body.code).toBe('DUPLICATE_EMPLOYEE')
  })

  test('distinct national ID and phone still create successfully', async () => {
    const hrHead = await createUser({ role: 'department_head', department: 'hr' })
    const res = await request(app)
      .post('/api/hr/employees')
      .set('Authorization', `Bearer ${tokenFor(hrHead)}`)
      .send({
        name: 'Unique Person',
        idNumber: 'ID-UNIQUE-99',
        phoneNumber: '+998908888999',
        employeeCode: 'EMP-UNIQUE-99',
        department: 'hr',
      })
    expect(res.status).toBe(201)
    expect(res.body.employee.idNumberNormalized).toBe('IDUNIQUE99')
    expect(res.body.employee.phoneNormalized).toBe('998908888999')
  })
})
