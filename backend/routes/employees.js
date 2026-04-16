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

// GET all employees
router.get('/', protect, async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 })
    res.json({ success: true, count: employees.length, employees })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// POST create employee
router.post('/', protect, async (req, res) => {
  try {
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
    const employee = await Employee.findByIdAndDelete(req.params.id)
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' })
    res.json({ success: true, message: 'Employee deleted.' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

module.exports = router
