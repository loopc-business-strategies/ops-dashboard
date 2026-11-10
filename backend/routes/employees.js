// ==========================================
// FILE: backend/routes/employees.js
// WHAT THIS DOES:
//   CRUD endpoints for HR employee records.
//
// ROUTES:
//   GET    /api/hr/employees       ← list all employees
//   GET    /api/hr/employees/:id   ← get one employee
//   POST   /api/hr/employees       ← create new employee
//   PUT    /api/hr/employees/:id   ← update employee
//   DELETE /api/hr/employees/:id   ← delete employee
//   GET/PUT /api/hr/employees/:id/salary-assignment  (LoopC structured payroll)
// ==========================================

const express  = require('express')
const Employee = require('../models/Employee')
const EmployeeRemark = require('../models/EmployeeRemark')
const EmployeeSalaryAssignment = require('../models/EmployeeSalaryAssignment')
const { protect } = require('../middleware/auth')
const { Joi, validateBody, validateParams } = require('../middleware/validate')
const { softDeleteById } = require('../utils/softDelete')
const { auditLog } = require('../middleware/audit')
const { requireStructuredPayroll } = require('../middleware/structuredPayrollGate')
const {
  canManageEmployees,
  canWriteFinanceModule,
  buildEmployeeReadFilter,
  normalize,
} = require('../services/permissions/moduleAccessPolicy')
const { normalizeComponents } = require('../services/payroll/payrollCalculationService')
const {
  applyEmployeeIdentityNormalizedFields,
  findEmployeeIdentityConflict,
  duplicateEmployeeError,
  archivedEmployeeError,
  isDuplicateKeyError,
  duplicateFieldFromMongoError,
} = require('../utils/employeeIdentity')
const { buildEmployedAsOfFilter, parseAsOfQuery } = require('../utils/employeeEmployment')
const {
  allocateNextEmployeeCode,
  resolveEmployeeCodeForCreate,
} = require('../utils/employeeCode')

const router = express.Router()

const employeeIdParam = Joi.object({ id: Joi.string().hex().length(24).required() })
const remarkBodySchema = Joi.object({
  text: Joi.string().trim().min(1).max(2000).required(),
})

const STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED']

const optionalProfileFields = {
  address:      Joi.string().trim().allow('').max(300).optional(),
  phoneNumber:  Joi.string().trim().allow('').max(30).optional(),
  department:   Joi.string().trim().allow('').max(80).optional(),
  rating:       Joi.number().integer().min(1).max(5).optional(),
  email:        Joi.string().trim().email({ tlds: { allow: false } }).allow('').max(160).optional(),
  photoUrl:     Joi.string().trim().allow('').max(500).optional(),
  emergencyContactName:  Joi.string().trim().allow('').max(120).optional(),
  emergencyContactPhone: Joi.string().trim().allow('').max(30).optional(),
  joiningDate:  Joi.alternatives().try(Joi.date().iso(), Joi.string().trim().allow('').max(40), Joi.valid(null)).optional(),
  position:     Joi.string().trim().allow('').max(120).optional(),
  managerName:  Joi.string().trim().allow('').max(120).optional(),
  shift:        Joi.string().trim().allow('').max(80).optional(),
  status:       Joi.string().valid(...STATUS_VALUES).optional(),
  contractRef:  Joi.string().trim().allow('').max(120).optional(),
  salaryRef:    Joi.string().trim().allow('').max(120).optional(),
  salaryAgreed: Joi.alternatives().try(Joi.number().min(0), Joi.valid(null), Joi.string().trim().allow('')).optional(),
  lastIncrement: Joi.alternatives().try(Joi.date().iso(), Joi.string().trim().allow('').max(40), Joi.valid(null)).optional(),
  rebate:       Joi.alternatives().try(Joi.number().min(0), Joi.valid(null), Joi.string().trim().allow('')).optional(),
  remarks:      Joi.string().trim().allow('').max(1000).optional(),
}

const createEmployeeSchema = Joi.object({
  name:         Joi.string().trim().min(2).max(120).required(),
  idNumber:     Joi.string().trim().min(1).max(60).required(),
  employeeCode: Joi.string().trim().allow('').max(40).optional(),
  ...optionalProfileFields,
})

const updateEmployeeSchema = Joi.object({
  name:         Joi.string().trim().min(2).max(120).optional(),
  idNumber:     Joi.string().trim().min(1).max(60).optional(),
  employeeCode: Joi.string().trim().min(1).max(40).optional(),
  ...optionalProfileFields,
}).min(1)

const componentSchema = Joi.object({
  code: Joi.string().trim().min(1).max(40).required(),
  label: Joi.string().trim().allow('').max(120).optional(),
  amount: Joi.number().min(0).required(),
})

const salaryAssignmentBody = Joi.object({
  earnings: Joi.array().items(componentSchema).default([]),
  deductions: Joi.array().items(componentSchema).default([]),
  employerContributions: Joi.array().items(componentSchema).default([]),
  effectiveFrom: Joi.alternatives().try(Joi.date().iso(), Joi.string().isoDate()).optional(),
  notes: Joi.string().trim().allow('').max(500).optional(),
})

function pickEmployeePayload(body) {
  const fields = [
    'name', 'idNumber', 'employeeCode', 'address', 'phoneNumber', 'department', 'rating',
    'email', 'photoUrl', 'emergencyContactName', 'emergencyContactPhone', 'joiningDate',
    'position', 'managerName', 'shift', 'status', 'contractRef', 'salaryRef',
    'salaryAgreed', 'lastIncrement', 'rebate', 'remarks',
  ]
  const dateFields = new Set(['joiningDate', 'lastIncrement'])
  const moneyFields = new Set(['salaryAgreed', 'rebate'])
  const out = {}
  for (const key of fields) {
    if (body[key] !== undefined) {
      if (dateFields.has(key)) {
        if (body[key] === '' || body[key] === null) out[key] = null
        else out[key] = new Date(body[key])
      } else if (moneyFields.has(key)) {
        if (body[key] === '' || body[key] === null) out[key] = null
        else {
          const n = Number(body[key])
          out[key] = Number.isFinite(n) ? n : null
        }
      } else {
        out[key] = body[key]
      }
    }
  }
  return applyEmployeeIdentityNormalizedFields(out)
}

async function rejectIfIdentityConflict(res, TenantEmployee, payload, excludeId = null) {
  const conflict = await findEmployeeIdentityConflict(TenantEmployee, {
    idNumberNormalized: payload.idNumberNormalized || '',
    phoneNormalized: payload.phoneNormalized || '',
    excludeId,
  })
  if (!conflict) return false
  if (conflict.archived) {
    res.status(409).json(archivedEmployeeError(conflict.field, conflict.employee._id))
  } else {
    res.status(409).json(duplicateEmployeeError(conflict.field, conflict.employee._id))
  }
  return true
}

async function sendDuplicateKeyResponse(res, err, TenantEmployee = null) {
  const field = duplicateFieldFromMongoError(err)
  if (field === 'employeeCode') {
    return res.status(400).json({ success: false, message: 'An employee with this code already exists.' })
  }
  if (field === 'idNumber' || field === 'phoneNumber') {
    let existingId = null
    const keyValue = err?.keyValue || {}
    if (TenantEmployee) {
      const q = { isDeleted: { $ne: true } }
      if (keyValue.idNumberNormalized) q.idNumberNormalized = keyValue.idNumberNormalized
      else if (keyValue.phoneNormalized) q.phoneNormalized = keyValue.phoneNormalized
      if (q.idNumberNormalized || q.phoneNormalized) {
        const found = await TenantEmployee.findOne(q).select('_id').lean()
        existingId = found?._id || null
      }
    }
    return res.status(409).json(duplicateEmployeeError(field, existingId))
  }
  return res.status(400).json({ success: false, message: 'An employee with this identity already exists.' })
}

// GET all employees (default: active only; ?asOf=YYYY-MM-DD = employed on that date)
router.get('/', protect, async (req, res) => {
  try {
    const TenantEmployee = await Employee.getTenantModel(req.tenant)
    const filter = buildEmployeeReadFilter(req.user)
    if (filter === null) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }

    const page  = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 200))
    const skip  = (page - 1) * limit

    const asOf = parseAsOfQuery(req.query.asOf)
    let listFilter
    if (asOf) {
      const asOfFilter = buildEmployedAsOfFilter(asOf)
      if (!asOfFilter) {
        return res.status(400).json({ success: false, message: 'Invalid asOf date. Use YYYY-MM-DD.' })
      }
      listFilter = { $and: [filter, asOfFilter] }
    } else {
      listFilter = { $and: [filter, { isDeleted: { $ne: true } }] }
    }

    const [employees, total] = await Promise.all([
      TenantEmployee.find(listFilter).select('-__v').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      TenantEmployee.countDocuments(listFilter),
    ])
    res.json({
      success: true,
      count: employees.length,
      total,
      page,
      limit,
      asOf: asOf || null,
      employees,
    })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// Next EMP code (includes archived) — must be before /:id
router.get('/next-code', protect, async (req, res) => {
  try {
    const TenantEmployee = await Employee.getTenantModel(req.tenant)
    if (!canManageEmployees(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }
    const employeeCode = await allocateNextEmployeeCode(TenantEmployee)
    res.json({ success: true, employeeCode })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// GET one employee (active by default; ?includeArchived=1 for archived)
router.get('/:id', protect, validateParams(employeeIdParam), async (req, res) => {
  try {
    const TenantEmployee = await Employee.getTenantModel(req.tenant)
    const filter = buildEmployeeReadFilter(req.user)
    if (filter === null) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }

    const includeArchived = String(req.query.includeArchived || '') === '1'
    const q = { _id: req.params.id, ...filter }
    if (!includeArchived) q.isDeleted = { $ne: true }

    const employee = await TenantEmployee.findOne(q).lean()
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' })
    res.json({ success: true, employee })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// POST create employee
router.post('/', protect, validateBody(createEmployeeSchema), async (req, res) => {
  try {
    const TenantEmployee = await Employee.getTenantModel(req.tenant)
    if (!canManageEmployees(req.user)) {
      return res.status(403).json({ success: false, message: 'Only super admin or HR department head can create employees.' })
    }

    const payload = pickEmployeePayload(req.body)
    if (!payload.name || !payload.idNumber) {
      return res.status(400).json({ success: false, message: 'Name and ID number are required.' })
    }

    payload.isDeleted = false
    if (await rejectIfIdentityConflict(res, TenantEmployee, payload)) return

    const maxAttempts = 5
    let lastErr = null
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      payload.employeeCode = await resolveEmployeeCodeForCreate(TenantEmployee, payload.employeeCode)
      try {
        const employee = await TenantEmployee.create(payload)
        return res.status(201).json({ success: true, employee })
      } catch (err) {
        lastErr = err
        if (isDuplicateKeyError(err) && duplicateFieldFromMongoError(err) === 'employeeCode') {
          payload.employeeCode = ''
          continue
        }
        if (isDuplicateKeyError(err)) {
          return sendDuplicateKeyResponse(res, err, TenantEmployee)
        }
        throw err
      }
    }
    if (isDuplicateKeyError(lastErr)) {
      return sendDuplicateKeyResponse(res, lastErr, TenantEmployee)
    }
    res.status(500).json({ success: false, message: 'Server error.' })
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const TenantEmployee = await Employee.getTenantModel(req.tenant)
      return sendDuplicateKeyResponse(res, err, TenantEmployee)
    }
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// Reactivate archived employee
router.post('/:id/reactivate', protect, validateParams(employeeIdParam), async (req, res) => {
  try {
    const TenantEmployee = await Employee.getTenantModel(req.tenant)
    if (!canManageEmployees(req.user)) {
      return res.status(403).json({ success: false, message: 'Only super admin or HR department head can reactivate employees.' })
    }

    const employee = await TenantEmployee.findById(req.params.id)
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' })

    if (req.user.role !== 'super_admin' && normalize(employee.department) !== 'hr') {
      return res.status(403).json({ success: false, message: 'HR department head can only reactivate HR employees.' })
    }

    if (employee.isDeleted !== true) {
      return res.status(400).json({ success: false, message: 'Employee is already active.' })
    }

    employee.isDeleted = false
    employee.deletedAt = null
    employee.deletedBy = null
    employee.deletedByName = ''
    employee.deletionReason = ''
    if (employee.status === 'TERMINATED') employee.status = 'ACTIVE'
    await employee.save()

    res.json({ success: true, employee })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// PUT update employee
router.put('/:id', protect, validateParams(employeeIdParam), validateBody(updateEmployeeSchema), async (req, res) => {
  try {
    const TenantEmployee = await Employee.getTenantModel(req.tenant)
    if (!canManageEmployees(req.user)) {
      return res.status(403).json({ success: false, message: 'Only super admin or HR department head can update employees.' })
    }

    const existingEmployee = await TenantEmployee.findById(req.params.id)
    if (!existingEmployee) return res.status(404).json({ success: false, message: 'Employee not found.' })

    if (req.user.role !== 'super_admin' && normalize(existingEmployee.department) !== 'hr') {
      return res.status(403).json({ success: false, message: 'HR department head can only update HR employees.' })
    }

    const payload = pickEmployeePayload(req.body)
    if (await rejectIfIdentityConflict(res, TenantEmployee, payload, existingEmployee._id)) return

    const employee = await TenantEmployee.findByIdAndUpdate(req.params.id, payload, { returnDocument: 'after', runValidators: true })
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' })

    res.json({ success: true, employee })
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const TenantEmployee = await Employee.getTenantModel(req.tenant)
      return sendDuplicateKeyResponse(res, err, TenantEmployee)
    }
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// DELETE employee
router.delete('/:id', protect, validateParams(employeeIdParam), async (req, res) => {
  try {
    const TenantEmployee = await Employee.getTenantModel(req.tenant)
    if (!canManageEmployees(req.user)) {
      return res.status(403).json({ success: false, message: 'Only super admin or HR department head can delete employees.' })
    }

    const employee = await TenantEmployee.findById(req.params.id)
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' })

    if (req.user.role !== 'super_admin' && normalize(employee.department) !== 'hr') {
      return res.status(403).json({ success: false, message: 'HR department head can only delete HR employees.' })
    }

    await softDeleteById(TenantEmployee, req.params.id, req)
    res.json({ success: true, message: 'Employee deleted.' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

const rebateCollectedSchema = Joi.object({
  year: Joi.number().integer().min(2000).max(2100).required(),
  month: Joi.number().integer().min(1).max(12).required(),
  collected: Joi.boolean().required(),
  amount: Joi.number().min(0).optional(),
  collectedAt: Joi.alternatives().try(Joi.date().iso(), Joi.string().isoDate(), Joi.valid(null, '')).optional(),
})

function payrollMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function toMoneyAmount(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

function parseCollectedAt(value) {
  if (value === null || value === undefined || value === '') return new Date()
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

// PATCH mark rebate collected for a payroll month (amount + date)
router.patch(
  '/:id/rebate-collected',
  protect,
  validateParams(employeeIdParam),
  validateBody(rebateCollectedSchema),
  async (req, res) => {
    try {
      const TenantEmployee = await Employee.getTenantModel(req.tenant)
      if (!canManageEmployees(req.user)) {
        return res.status(403).json({ success: false, message: 'Only super admin or HR staff can update rebate status.' })
      }

      const employee = await TenantEmployee.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
      if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' })

      const key = payrollMonthKey(req.body.year, req.body.month)
      const months = Array.isArray(employee.rebateCollectedMonths)
        ? employee.rebateCollectedMonths.map(String)
        : []
      const collections = Array.isArray(employee.rebateCollections)
        ? employee.rebateCollections.map((c) => ({
          month: String(c.month || ''),
          amount: toMoneyAmount(c.amount),
          collectedAt: c.collectedAt || null,
        })).filter((c) => c.month)
        : []

      if (req.body.collected) {
        const agreed = Number(employee.rebate)
        const defaultAmount = Number.isFinite(agreed) && agreed > 0 ? agreed : 0
        const amount = req.body.amount === undefined || req.body.amount === null
          ? toMoneyAmount(defaultAmount)
          : toMoneyAmount(req.body.amount)
        const collectedAt = parseCollectedAt(req.body.collectedAt)
        const nextCollections = collections.filter((c) => c.month !== key)
        nextCollections.push({ month: key, amount, collectedAt })
        employee.rebateCollections = nextCollections
        employee.rebateCollectedMonths = months.includes(key) ? months : [...months, key]
      } else {
        employee.rebateCollections = collections.filter((c) => c.month !== key)
        employee.rebateCollectedMonths = months.filter((k) => k !== key)
      }

      await employee.save()

      res.json({ success: true, employee })
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error.' })
    }
  },
)

// ─── Append-only employee remarks log ───

router.get('/:id/remarks', protect, validateParams(employeeIdParam), async (req, res) => {
  try {
    const TenantEmployee = await Employee.getTenantModel(req.tenant)
    const filter = buildEmployeeReadFilter(req.user)
    if (filter === null) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }

    const employee = await TenantEmployee.findOne({
      _id: req.params.id,
      isDeleted: { $ne: true },
      ...filter,
    }).lean()
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' })

    const TenantRemark = await EmployeeRemark.getTenantModel(req.tenant)
    const remarks = await TenantRemark.find({ employeeId: employee._id })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()

    res.json({ success: true, count: remarks.length, remarks })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.post('/:id/remarks', protect, validateParams(employeeIdParam), validateBody(remarkBodySchema), async (req, res) => {
  try {
    if (!canManageEmployees(req.user)) {
      return res.status(403).json({ success: false, message: 'Only super admin or HR department head can add remarks.' })
    }

    const TenantEmployee = await Employee.getTenantModel(req.tenant)
    const employee = await TenantEmployee.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' })

    if (req.user.role !== 'super_admin' && normalize(employee.department) !== 'hr') {
      return res.status(403).json({ success: false, message: 'HR department head can only add remarks for HR employees.' })
    }

    const TenantRemark = await EmployeeRemark.getTenantModel(req.tenant)
    const remark = await TenantRemark.create({
      employeeId: employee._id,
      employeeName: employee.name || '',
      text: String(req.body.text).trim(),
      createdById: req.user._id,
      createdByName: req.user.name || '',
    })

    res.status(201).json({ success: true, remark })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ─── LoopC salary assignment (also available under /api/finance/payroll-v2) ───

router.get('/:id/salary-assignment', protect, validateParams(employeeIdParam), async (req, res) => {
  if (!requireStructuredPayroll(req, res)) return
  try {
    if (!canManageEmployees(req.user) && !canWriteFinanceModule(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }
    const TenantAssignment = await EmployeeSalaryAssignment.getTenantModel(req.tenant)
    const assignment = await TenantAssignment.findOne({
      employeeId: req.params.id,
      isActive: true,
      isDeleted: { $ne: true },
    }).lean()
    res.json({ success: true, data: assignment || null })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.put('/:id/salary-assignment', protect, validateParams(employeeIdParam), validateBody(salaryAssignmentBody), async (req, res) => {
  if (!requireStructuredPayroll(req, res)) return
  try {
    if (!canManageEmployees(req.user) && !canWriteFinanceModule(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }

    const TenantEmployee = await Employee.getTenantModel(req.tenant)
    const employee = await TenantEmployee.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' })

    const TenantAssignment = await EmployeeSalaryAssignment.getTenantModel(req.tenant)
    const existing = await TenantAssignment.findOne({
      employeeId: employee._id,
      isActive: true,
      isDeleted: { $ne: true },
    })

    const payload = {
      earnings: normalizeComponents(req.body.earnings),
      deductions: normalizeComponents(req.body.deductions),
      employerContributions: normalizeComponents(req.body.employerContributions),
      effectiveFrom: req.body.effectiveFrom ? new Date(req.body.effectiveFrom) : new Date(),
      notes: req.body.notes || '',
      createdById: req.user._id,
      createdByName: req.user.name,
      isActive: true,
      isDeleted: false,
    }

    let assignment
    if (existing) {
      existing.isActive = false
      await existing.save()
      assignment = await TenantAssignment.create({
        ...payload,
        employeeId: employee._id,
        version: (existing.version || 1) + 1,
      })
    } else {
      assignment = await TenantAssignment.create({
        ...payload,
        employeeId: employee._id,
        version: 1,
      })
    }

    await auditLog(req, {
      resource: 'EmployeeSalaryAssignment',
      resourceId: assignment._id,
      action: existing ? 'salary_assignment_updated' : 'salary_assignment_created',
      detail: `Employee ${employee.employeeCode} via HR`,
    })

    res.json({ success: true, data: assignment })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Active salary assignment conflict. Retry.' })
    }
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

module.exports = router
