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

const router = express.Router()

const employeeIdParam = Joi.object({ id: Joi.string().hex().length(24).required() })

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
}

const createEmployeeSchema = Joi.object({
  name:         Joi.string().trim().min(2).max(120).required(),
  idNumber:     Joi.string().trim().min(1).max(60).required(),
  employeeCode: Joi.string().trim().min(1).max(40).required(),
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
  ]
  const out = {}
  for (const key of fields) {
    if (body[key] !== undefined) {
      if (key === 'joiningDate') {
        if (body[key] === '' || body[key] === null) out[key] = null
        else out[key] = new Date(body[key])
      } else {
        out[key] = body[key]
      }
    }
  }
  return out
}

// GET all employees
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

    const activeFilter = { $and: [filter, { isDeleted: { $ne: true } }] }
    const [employees, total] = await Promise.all([
      TenantEmployee.find(activeFilter).select('-__v').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      TenantEmployee.countDocuments(activeFilter),
    ])
    res.json({ success: true, count: employees.length, total, page, limit, employees })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// GET one employee
router.get('/:id', protect, validateParams(employeeIdParam), async (req, res) => {
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
    if (!payload.name || !payload.idNumber || !payload.employeeCode)
      return res.status(400).json({ success: false, message: 'Name, ID number, and employee code are required.' })

    const employee = await TenantEmployee.create(payload)
    res.status(201).json({ success: true, employee })
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ success: false, message: 'An employee with this code already exists.' })
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
    const employee = await TenantEmployee.findByIdAndUpdate(req.params.id, payload, { returnDocument: 'after', runValidators: true })
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' })

    res.json({ success: true, employee })
  } catch (err) {
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
