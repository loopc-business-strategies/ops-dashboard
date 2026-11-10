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
    // MTD clip: same local dayKey rules as routes/attendance.js
    const monthEndFull = '2026-10-31'
    const now = new Date()
    const todayKey = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}`
    const expectedTo =
      todayKey < '2026-10-01' ? '2026-10-01' : todayKey > monthEndFull ? monthEndFull : todayKey
    expect(statsRes.body.to).toBe(expectedTo)

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

  it('rejects marking attendance before joiningDate', async () => {
    const admin = await User.create({
      name: 'hr-admin-prejoin',
      email: 'hr-admin-prejoin@example.com',
      password: 'password123',
      role: 'super_admin',
      department: 'hr',
    })
    const token = tokenFor(admin)

    const TenantEmployee = await Employee.getTenantModel(TEST_TENANT)
    const emp = await TenantEmployee.create({
      name: 'Prejoin Block Emp',
      idNumber: 'ID-PREJOIN-001',
      employeeCode: 'EMP-PREJOIN-001',
      department: 'hr',
      joiningDate: new Date('2026-11-03T00:00:00.000Z'),
    })

    const blocked = await request(app)
      .post('/api/attendance/records')
      .set('Authorization', `Bearer ${token}`)
      .send({
        employeeId: emp._id.toString(),
        employeeName: emp.name,
        department: 'hr',
        date: '2026-11-01',
        status: 'present',
        checkIn: '09:00',
        checkOut: '18:00',
      })
    expect(blocked.status).toBe(400)
    expect(blocked.body.message).toMatch(/employment period/i)

    const allowed = await request(app)
      .post('/api/attendance/records')
      .set('Authorization', `Bearer ${token}`)
      .send({
        employeeId: emp._id.toString(),
        employeeName: emp.name,
        department: 'hr',
        date: '2026-11-03',
        status: 'present',
        checkIn: '09:00',
        checkOut: '18:00',
      })
    expect(allowed.status).toBe(200)
    expect(allowed.body.record.date).toBe('2026-11-03')
  })

  it('summary only includes employees joined on or before the date', async () => {
    const admin = await User.create({
      name: 'hr-admin-summary-join',
      email: 'hr-admin-summary-join@example.com',
      password: 'password123',
      role: 'super_admin',
      department: 'hr',
    })
    const token = tokenFor(admin)

    const TenantEmployee = await Employee.getTenantModel(TEST_TENANT)
    await TenantEmployee.create({
      name: 'Early Joiner',
      idNumber: 'ID-SUM-EARLY',
      employeeCode: 'EMP-SUM-EARLY',
      department: 'hr',
      joiningDate: new Date('2026-10-01T00:00:00.000Z'),
    })
    await TenantEmployee.create({
      name: 'Late Joiner',
      idNumber: 'ID-SUM-LATE',
      employeeCode: 'EMP-SUM-LATE',
      department: 'hr',
      joiningDate: new Date('2026-11-10T00:00:00.000Z'),
    })
    await TenantEmployee.create({
      name: 'Legacy No Join',
      idNumber: 'ID-SUM-LEGACY',
      employeeCode: 'EMP-SUM-LEGACY',
      department: 'hr',
    })

    const res = await request(app)
      .get('/api/attendance/summary')
      .query({ date: '2026-11-01' })
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const names = (res.body.rows || []).map((r) => r.name)
    expect(names).toContain('Early Joiner')
    expect(names).toContain('Legacy No Join')
    expect(names).not.toContain('Late Joiner')
  })

  it('excludes attendance before joiningDate from workedDays', async () => {
    const admin = await User.create({
      name: 'hr-admin-join',
      email: 'hr-admin-join@example.com',
      password: 'password123',
      role: 'super_admin',
      department: 'hr',
    })
    const token = tokenFor(admin)

    const TenantEmployee = await Employee.getTenantModel(TEST_TENANT)
    const emp = await TenantEmployee.create({
      name: 'Late Joiner Emp',
      idNumber: 'ID-JOIN-001',
      employeeCode: 'EMP-JOIN-001',
      department: 'hr',
      salaryAgreed: 5650000,
      joiningDate: new Date('2026-11-03T00:00:00.000Z'),
    })

    // Pre-join rows may already exist from older bulk marks; seed via DB to assert stats ignore them.
    const TenantAttendance = await AttendanceRecord.getTenantModel(TEST_TENANT)
    await TenantAttendance.create([
      {
        employeeId: emp._id,
        employeeName: emp.name,
        department: 'hr',
        date: '2026-11-01',
        status: 'present',
        checkIn: '09:00',
        checkOut: '18:00',
      },
      {
        employeeId: emp._id,
        employeeName: emp.name,
        department: 'hr',
        date: '2026-11-02',
        status: 'present',
        checkIn: '09:00',
        checkOut: '18:00',
      },
    ])

    for (const date of ['2026-11-03', '2026-11-04', '2026-11-05']) {
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
    }

    const statsRes = await request(app)
      .get('/api/attendance/month-stats')
      .query({ year: 2026, month: 11 })
      .set('Authorization', `Bearer ${token}`)

    expect(statsRes.status).toBe(200)
    const row = (statsRes.body.stats || []).find(
      (s) => String(s.employeeId) === String(emp._id),
    )
    expect(row).toBeTruthy()
    // Pre-join Nov 1–2 must not count; only Nov 3–5 (clipped by MTD endDate if earlier).
    const endDate = statsRes.body.to
    const expectedDates = ['2026-11-03', '2026-11-04', '2026-11-05'].filter((d) => d <= endDate)
    expect(row.workedDays).toBe(expectedDates.length)
  })

  it('GET /records returns legacy ISO same-day rows without deleting them', async () => {
    const admin = await User.create({
      name: 'hr-admin-iso',
      email: 'hr-admin-iso@example.com',
      password: 'password123',
      role: 'super_admin',
      department: 'hr',
    })
    const token = tokenFor(admin)

    const TenantAttendance = await AttendanceRecord.getTenantModel(TEST_TENANT)
    await TenantAttendance.create({
      employeeName: 'Legacy ISO Emp',
      department: 'hr',
      date: '2026-10-15T00:00:00.000Z',
      status: 'present',
      checkIn: '09:00',
      checkOut: '17:00',
    })

    const before = await TenantAttendance.find({ employeeName: 'Legacy ISO Emp' }).lean()
    expect(before).toHaveLength(1)
    expect(before[0].date).toBe('2026-10-15T00:00:00.000Z')

    const res = await request(app)
      .get('/api/attendance/records')
      .query({ date: '2026-10-15' })
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.count).toBe(1)
    expect(res.body.records[0].employeeName).toBe('Legacy ISO Emp')
    expect(res.body.records[0].date).toBe('2026-10-15')
    expect(res.body.records[0].status).toBe('present')

    const after = await TenantAttendance.find({ employeeName: 'Legacy ISO Emp' }).lean()
    expect(after).toHaveLength(1)
    expect(after[0].date).toBe('2026-10-15T00:00:00.000Z')
  })
})
