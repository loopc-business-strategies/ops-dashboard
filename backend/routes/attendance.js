const express = require('express')
const { protect } = require('../middleware/auth')
const AttendanceRecord = require('../models/AttendanceRecord')
const LeaveRequest = require('../models/LeaveRequest')
const Employee = require('../models/Employee')
const { Joi, validateBody, validateParams } = require('../middleware/validate')

const router = express.Router()

const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'leave', 'wfh', 'holiday']
const LEAVE_TYPES = ['personal', 'sick', 'annual', 'emergency', 'maternity', 'paternity', 'unpaid', 'other']
const LEAVE_DECISIONS = ['approved', 'rejected']

const recordIdParam = Joi.object({ id: Joi.string().hex().length(24).required() })

const attendanceRecordSchema = Joi.object({
  employeeId:   Joi.string().hex().length(24).allow('', null).optional(),
  userId:       Joi.string().hex().length(24).allow('', null).optional(),
  employeeName: Joi.string().trim().min(1).max(120).required(),
  department:   Joi.string().trim().min(1).max(80).required(),
  date:         Joi.string().isoDate().optional(),
  status:       Joi.string().valid(...ATTENDANCE_STATUSES).optional(),
  checkIn:      Joi.string().trim().allow('').max(10).optional(),
  checkOut:     Joi.string().trim().allow('').max(10).optional(),
  shift:        Joi.string().trim().allow('').max(50).optional(),
  notes:        Joi.string().trim().allow('').max(500).optional(),
})

const leaveRequestSchema = Joi.object({
  startDate:    Joi.string().isoDate().required(),
  endDate:      Joi.string().isoDate().required(),
  reason:       Joi.string().trim().allow('').max(1000).optional(),
  leaveType:    Joi.string().valid(...LEAVE_TYPES).optional(),
  employeeName: Joi.string().trim().allow('').max(120).optional(),
  department:   Joi.string().trim().allow('').max(80).optional(),
})

const leaveDecisionSchema = Joi.object({
  status:     Joi.string().valid(...LEAVE_DECISIONS).required(),
  reviewNote: Joi.string().trim().allow('').max(500).optional(),
})

const normalize = (value = '') => String(value).trim().toLowerCase()
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const isSuper = (user) => user?.role === 'super_admin'
const isManagement = (user) => user?.role === 'management'
const isHrHead = (user) => user?.role === 'department_head' && normalize(user.department) === 'hr'

const canManageAttendance = (user) => isSuper(user) || isHrHead(user)
const canReviewLeave = (user) => isSuper(user) || isHrHead(user) || user?.role === 'department_head'

const scopedDepartment = (user) => {
  if (!user) return null
  if (isSuper(user) || isManagement(user) || isHrHead(user)) return null
  if (user.role === 'department_head' || user.role === 'department_user') {
    return normalize(user.department)
  }
  return null
}

const canTouchDepartment = (user, department) => {
  if (isSuper(user) || isHrHead(user)) return true
  if (user?.role === 'department_head') return normalize(user.department) === normalize(department)
  return false
}

const dayKey = (date = new Date()) => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const daysBetweenInclusive = (start, end) => {
  const ms = 24 * 60 * 60 * 1000
  const a = new Date(start)
  const b = new Date(end)
  a.setHours(0, 0, 0, 0)
  b.setHours(0, 0, 0, 0)
  return Math.max(1, Math.round((b - a) / ms) + 1)
}

router.get('/records', protect, async (req, res) => {
  try {
    const { date = dayKey(), department = 'all', status = 'all', search = '', limit = 400 } = req.query

    const query = { date: String(date) }
    const deptScope = scopedDepartment(req.user)

    if (deptScope) {
      query.department = new RegExp(`^${escapeRegex(deptScope)}$`, 'i')
    } else if (department !== 'all') {
      query.department = new RegExp(`^${escapeRegex(String(department))}$`, 'i')
    }

    if (status !== 'all') {
      query.status = String(status)
    }

    if (search) {
      query.employeeName = new RegExp(escapeRegex(String(search)), 'i')
    }

    if (req.user.role === 'department_user' || req.user.role === 'external') {
      query.employeeName = new RegExp(`^${escapeRegex(req.user.name)}$`, 'i')
    }

    const records = await AttendanceRecord.find(query).sort({ employeeName: 1 }).limit(Number(limit) || 400)
    res.json({ success: true, count: records.length, records })
  } catch {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.get('/summary', protect, async (req, res) => {
  try {
    const date = String(req.query.date || dayKey())
    const deptScope = scopedDepartment(req.user)

    const employeeFilter = {}
    if (deptScope) employeeFilter.department = new RegExp(`^${escapeRegex(deptScope)}$`, 'i')

    let employees = await Employee.find(employeeFilter).select('name department')

    if (!employees.length) {
      employees = [{ _id: null, name: req.user.name, department: req.user.department || '' }]
    }

    const recordFilter = { date }
    if (deptScope) recordFilter.department = new RegExp(`^${escapeRegex(deptScope)}$`, 'i')

    let records = await AttendanceRecord.find(recordFilter)

    if (req.user.role === 'department_user' || req.user.role === 'external') {
      employees = employees.filter((e) => normalize(e.name) === normalize(req.user.name))
      records = records.filter((r) => normalize(r.employeeName) === normalize(req.user.name))
    }

    const recordByName = new Map(records.map((r) => [normalize(r.employeeName), r]))

    const rows = employees.map((employee) => {
      const rec = recordByName.get(normalize(employee.name))
      return {
        id: employee._id || employee.name,
        name: employee.name,
        department: employee.department || '',
        status: rec?.status || 'absent',
        checkIn: rec?.checkIn || '-',
        shift: rec?.shift || 'Shift 1',
      }
    })

    const total = rows.length || 1
    const present = rows.filter((r) => r.status === 'present').length
    const absent = rows.filter((r) => r.status === 'absent').length
    const onLeave = rows.filter((r) => r.status === 'leave').length
    const late = rows.filter((r) => r.status === 'late').length

    const byDepartment = Object.values(rows.reduce((acc, r) => {
      const key = normalize(r.department) || 'unassigned'
      if (!acc[key]) {
        acc[key] = { dept: key, present: 0, total: 0 }
      }
      acc[key].total += 1
      if (['present', 'late', 'wfh'].includes(r.status)) acc[key].present += 1
      return acc
    }, {})).map((d) => ({ ...d, pct: d.total ? Math.round((d.present / d.total) * 100) : 0 }))

    res.json({
      success: true,
      summary: {
        date,
        total,
        present,
        absent,
        onLeave,
        late,
        percent: Math.round((present / total) * 100),
      },
      rows,
      byDepartment,
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.get('/me', protect, async (req, res) => {
  try {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const records = await AttendanceRecord.find({
      employeeName: new RegExp(`^${escapeRegex(req.user.name)}$`, 'i'),
      createdAt: { $gte: monthStart },
    }).sort({ createdAt: -1 })

    const presentDays = records.filter((r) => ['present', 'late', 'wfh'].includes(r.status)).length
    const leaveDays = records.filter((r) => r.status === 'leave').length
    const totalDays = Math.max(records.length, 1)

    const todayRecord = await AttendanceRecord.findOne({
      employeeName: new RegExp(`^${escapeRegex(req.user.name)}$`, 'i'),
      date: dayKey(),
    })

    res.json({
      success: true,
      me: {
        presentDays,
        leaveDays,
        totalDays,
        attendancePct: Math.round((presentDays / totalDays) * 100),
        todayStatus: todayRecord?.status || 'absent',
        todayCheckIn: todayRecord?.checkIn || '-',
      },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.post('/records', protect, validateBody(attendanceRecordSchema), async (req, res) => {
  try {
    if (!canManageAttendance(req.user)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to mark attendance.' })
    }

    const { employeeId, userId, employeeName, department, date = dayKey(), status = 'present', checkIn = '', checkOut = '', shift = 'Shift 1', notes = '' } = req.body

    if (!employeeName || !department) {
      return res.status(400).json({ success: false, message: 'Employee name and department are required.' })
    }

    if (!canTouchDepartment(req.user, department)) {
      return res.status(403).json({ success: false, message: 'You can only mark attendance for your department.' })
    }

    const payload = {
      employeeId: employeeId || null,
      userId: userId || null,
      employeeName: String(employeeName).trim(),
      department: String(department).trim().toLowerCase(),
      date: String(date),
      status,
      checkIn,
      checkOut,
      shift,
      notes,
      markedById: req.user._id,
      markedByName: req.user.name,
    }

    const record = await AttendanceRecord.findOneAndUpdate(
      { date: payload.date, employeeName: payload.employeeName },
      payload,
      { new: true, upsert: true, runValidators: true }
    )

    res.json({ success: true, record })
  } catch {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.get('/leave', protect, async (req, res) => {
  try {
    const { status = 'all', limit = 100 } = req.query
    const query = {}

    if (status !== 'all') query.status = String(status)

    if (isSuper(req.user) || isManagement(req.user) || isHrHead(req.user)) {
      // global read
    } else if (req.user.role === 'department_head') {
      query.department = new RegExp(`^${escapeRegex(req.user.department)}$`, 'i')
    } else {
      query.employeeName = new RegExp(`^${escapeRegex(req.user.name)}$`, 'i')
    }

    const requests = await LeaveRequest.find(query).sort({ createdAt: -1 }).limit(Number(limit) || 100)
    res.json({ success: true, count: requests.length, requests })
  } catch {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.post('/leave', protect, validateBody(leaveRequestSchema), async (req, res) => {
  try {
    if (isManagement(req.user)) {
      return res.status(403).json({ success: false, message: 'Management accounts cannot submit leave requests.' })
    }

    const { startDate, endDate, reason = '', leaveType = 'personal', employeeName, department } = req.body

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Start and end date are required.' })
    }

    const resolvedName = (employeeName || req.user.name || '').trim()
    const resolvedDept = normalize(department || req.user.department)

    if (!resolvedName || !resolvedDept) {
      return res.status(400).json({ success: false, message: 'Employee name and department are required.' })
    }

    if ((req.user.role === 'department_user' || req.user.role === 'external') && normalize(req.user.name) !== normalize(resolvedName)) {
      return res.status(403).json({ success: false, message: 'You can only submit leave for your own profile.' })
    }

    const request = await LeaveRequest.create({
      requesterUserId: req.user._id,
      employeeName: resolvedName,
      department: resolvedDept,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      days: daysBetweenInclusive(startDate, endDate),
      reason,
      leaveType,
      status: 'pending',
    })

    res.status(201).json({ success: true, request })
  } catch {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.put('/leave/:id/decision', protect, validateParams(recordIdParam), validateBody(leaveDecisionSchema), async (req, res) => {
  try {
    if (!canReviewLeave(req.user)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to review leave requests.' })
    }

    const { status, reviewNote = '' } = req.body
    if (!['approved', 'rejected'].includes(String(status))) {
      return res.status(400).json({ success: false, message: 'Status must be approved or rejected.' })
    }

    const leaveRequest = await LeaveRequest.findById(req.params.id)
    if (!leaveRequest) {
      return res.status(404).json({ success: false, message: 'Leave request not found.' })
    }

    if (!isSuper(req.user) && !isHrHead(req.user) && normalize(leaveRequest.department) !== normalize(req.user.department)) {
      return res.status(403).json({ success: false, message: 'You can only review requests from your department.' })
    }

    leaveRequest.status = String(status)
    leaveRequest.reviewedById = req.user._id
    leaveRequest.reviewedByName = req.user.name
    leaveRequest.reviewNote = String(reviewNote)
    leaveRequest.reviewedAt = new Date()
    await leaveRequest.save()

    res.json({ success: true, request: leaveRequest })
  } catch {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

module.exports = router
