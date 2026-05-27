// ==========================================
// FILE: backend/routes/employees.js
// WHAT THIS DOES:
//   CRUD endpoints for HR employee records.
//
// ROUTES:
//   GET    /api/hr/employees       ← list all employees
//   POST   /api/hr/employees       ← create new employee
//   PUT    /api/hr/employees/:id   ← update employee
//   DELETE /api/hr/employees/:id   ← delete employee
// ==========================================

const express  = require('express')
const Employee = require('../models/Employee')
const { protect } = require('../middleware/auth')
const { Joi, validateBody, validateParams } = require('../middleware/validate')
const { softDeleteById } = require('../utils/softDelete')
const {
  canManageEmployees,
  buildEmployeeReadFilter,
} = require('../services/permissions/moduleAccessPolicy')

const router = express.Router()

const employeeIdParam = Joi.object({ id: Joi.string().hex().length(24).required() })

const createEmployeeSchema = Joi.object({
  name:         Joi.string().trim().min(2).max(120).required(),
  idNumber:     Joi.string().trim().min(1).max(60).required(),
  employeeCode: Joi.string().trim().min(1).max(40).required(),
  address:      Joi.string().trim().allow('').max(300).optional(),
  phoneNumber:  Joi.string().trim().allow('').max(30).optional(),
  department:   Joi.string().trim().allow('').max(80).optional(),
  rating:       Joi.number().integer().min(1).max(5).optional(),
})

const updateEmployeeSchema = Joi.object({
  name:         Joi.string().trim().min(2).max(120).optional(),
  idNumber:     Joi.string().trim().min(1).max(60).optional(),
  employeeCode: Joi.string().trim().min(1).max(40).optional(),
  address:      Joi.string().trim().allow('').max(300).optional(),
  phoneNumber:  Joi.string().trim().allow('').max(30).optional(),
  department:   Joi.string().trim().allow('').max(80).optional(),
  rating:       Joi.number().integer().min(1).max(5).optional(),
}).min(1)

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
      TenantEmployee.find(activeFilter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      TenantEmployee.countDocuments(activeFilter),
    ])
    res.json({ success: true, count: employees.length, total, page, limit, employees })
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

    const { name, idNumber, employeeCode, address, phoneNumber, department, rating } = req.body

    if (!name || !idNumber || !employeeCode)
      return res.status(400).json({ success: false, message: 'Name, ID number, and employee code are required.' })

    const employee = await TenantEmployee.create({ name, idNumber, employeeCode, address, phoneNumber, department, rating })
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

    const employee = await TenantEmployee.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true })
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

module.exports = router
