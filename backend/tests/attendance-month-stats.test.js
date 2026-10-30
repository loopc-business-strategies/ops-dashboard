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
const AttendanceRecord = require('../models/AttendanceRecord')
const { daysInMonth, prorateMonthly } = require('../services/payroll/payrollCalculationService')

let mongo
let app

const TEST_TENANT = 'loopc'
const tokenFor = (user) => jwt.sign({ id: user._id.toString(), company: TEST_TENANT }, process.env.JWT_SECRET)

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
  await User.deleteMany({})
  const TenantEmployee = await Employee.getTenantModel(TEST_TENANT)
  await TenantEmployee.deleteMany({})
  const TenantAttendance = await AttendanceRecord.getTenantModel(TEST_TENANT)
  await TenantAttendance.deleteMany({})
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

describe('Attendance month-stats + MTD salary (5 worked days)', () => {
  it('counts 5 present days and matches payroll proration', async () => {
    const admin = await User.create({
      name: 'hr-admin-mtd',
      email: 'hr-admin-mtd@example.com',
      password: 'password123',
      role: 'super_admin',
      department: 'hr',
    })
    const token = tokenFor(admin)

    const TenantEmployee = await Employee.getTenantModel(TEST_TENANT)
    const emp = await TenantEmployee.create({
      name: 'Salary Test Emp',
      idNumber: 'ID-MTD-001',
      employeeCode: 'EMP-MTD-001',
      department: 'hr',
      salaryAgreed: 31000,
    })

    const dates = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']
    for (const date of dates) {
      const res = await request(app)
        .post('/api/attendance/records')
        .set('Authorization', `Bearer ${token}`)
        .send({
          employeeId: emp._id.toString(),
          employeeName: emp.name,
          department: 'hr',
          date,
          status: 'present',
          checkIn: '09:00',
          checkOut: '18:00',
        })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.record.date).toBe(date)
      expect(res.body.record.status).toBe('present')
    }

    const TenantAttendance = await AttendanceRecord.getTenantModel(TEST_TENANT)
    const stored = await TenantAttendance.find({ employeeName: emp.name }).lean()
    expect(stored).toHaveLength(5)
    expect(stored.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(String(r.date)))).toBe(true)

    const statsRes = await request(app)
      .get('/api/attendance/month-stats')
      .query({ year: 2026, month: 10 })
      .set('Authorization', `Bearer ${token}`)

    expect(statsRes.status).toBe(200)
    expect(statsRes.body.success).toBe(true)
    expect(statsRes.body.calendarDays).toBe(31)
    expect(statsRes.body.to).toBe('2026-10-30')

    const row = (statsRes.body.stats || []).find(
      (s) => String(s.employeeId) === String(emp._id) || String(s.employeeName).toLowerCase() === 'salary test emp',
    )
    expect(row).toBeTruthy()
    expect(row.workedDays).toBe(5)

    const calendarDays = daysInMonth(2026, 10)
    const accumulated = prorateMonthly(31000, calendarDays, row.workedDays)
    expect(calendarDays).toBe(31)
    expect(accumulated).toBe(5000)
  })
})
