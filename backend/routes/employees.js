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

const router = express.Router()

const normalize = (value = '') => String(value).trim().toLowerCase()

const canManageEmployees = (user) => {
  if (!user) return false
  if (user.role === 'super_admin') return true
  return user.role === 'department_head' && normalize(user.department) === 'hr'
}

const buildEmployeeReadFilter = (user) => {
  if (!user) return null
  if (user.role === 'super_admin' || user.role === 'management') return {}

  const userDepartment = normalize(user.department)
  if (!userDepartment) return null

  return { department: new RegExp(`^${userDepartment}$`, 'i') }
}

// GET all employees
router.get('/', protect, async (req, res) => {
  try {
    const filter = buildEmployeeReadFilter(req.user)
    if (filter === null) {
      return res.status(403).json({ success: false, message: 'Access denied.' })
    }

    const employees = await Employee.find(filter).sort({ createdAt: -1 })
    res.json({ success: true, count: employees.length, employees })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// POST create employee
router.post('/', protect, async (req, res) => {
  try {
    if (!canManageEmployees(req.user)) {
      return res.status(403).json({ success: false, message: 'Only super admin or HR department head can create employees.' })
    }

    const { name, idNumber, employeeCode, address, phoneNumber, department, rating } = req.body

    if (!name || !idNumber || !employeeCode)
      return res.status(400).json({ success: false, message: 'Name, ID number, and employee code are required.' })

    const employee = await Employee.create({ name, idNumber, employeeCode, address, phoneNumber, department, rating })
    res.status(201).json({ success: true, employee })
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ success: false, message: 'An employee with this code already exists.' })
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// PUT update employee
router.put('/:id', protect, async (req, res) => {
  try {
    if (!canManageEmployees(req.user)) {
      return res.status(403).json({ success: false, message: 'Only super admin or HR department head can update employees.' })
    }

    const existingEmployee = await Employee.findById(req.params.id)
    if (!existingEmployee) return res.status(404).json({ success: false, message: 'Employee not found.' })

    if (req.user.role !== 'super_admin' && normalize(existingEmployee.department) !== 'hr') {
      return res.status(403).json({ success: false, message: 'HR department head can only update HR employees.' })
    }

    const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' })

    res.json({ success: true, employee })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// DELETE employee
router.delete('/:id', protect, async (req, res) => {
  try {
    if (!canManageEmployees(req.user)) {
      return res.status(403).json({ success: false, message: 'Only super admin or HR department head can delete employees.' })
    }

    const employee = await Employee.findById(req.params.id)
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' })

    if (req.user.role !== 'super_admin' && normalize(employee.department) !== 'hr') {
      return res.status(403).json({ success: false, message: 'HR department head can only delete HR employees.' })
    }

    await Employee.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Employee deleted.' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

module.exports = router
