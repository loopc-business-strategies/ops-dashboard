// ==========================================
// FILE: backend/routes/auth.js
// WHAT THIS DOES:
//   Handles all user authentication API endpoints.
//   No public signup — Super Admin creates all users.
//
// ROUTES:
//   POST /api/auth/setup            ← one-time first admin creation
//   POST /api/auth/login            ← login with name + password
//   GET  /api/auth/me               ← get my own profile
//   GET  /api/auth/users            ← list all users (super_admin only)
//   POST /api/auth/users            ← create new user (super_admin only)
//   PUT  /api/auth/users/:id/role   ← change role (super_admin only)
//   PUT  /api/auth/users/:id/toggle ← activate/deactivate (super_admin only)
// ==========================================

const express = require('express')
const jwt     = require('jsonwebtoken')
const User    = require('../models/User')
const { protect, restrictTo } = require('../middleware/auth')

const router = express.Router()

// Helper: create a JWT token for a user
const createToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })

// Helper: send user data + token as response
const sendToken = (user, status, res) => {
  const token = createToken(user._id)
  user.password = undefined // never send password
  res.status(status).json({
    success: true,
    token,
    user: {
      id:             user._id,
      name:           user.name,
      email:          user.email,
      role:           user.role,
      department:     user.department,
      allowedModules: user.allowedModules,
      assignedTasks:  user.assignedTasks,
    },
  })
}

// ==========================================
// POST /api/auth/setup
// Creates the FIRST Super Admin account.
// Only works when database has zero users.
// After first use, this endpoint is permanently blocked.
// ==========================================
router.post('/setup', async (req, res) => {
  try {
    const count = await User.countDocuments()
    if (count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Setup already done. Super Admin already exists.',
      })
    }

    const { name, password } = req.body
    if (!name || !password)
      return res.status(400).json({ success: false, message: 'Name and password are required.' })
    if (password.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' })

    // Create super admin — use name as login identifier (no email needed)
    const user = await User.create({
      name:  name.trim(),
      email: `${name.trim().toLowerCase().replace(/\s+/g, '.')}@system.local`,
      password,
      role: 'super_admin',
    })

    sendToken(user, 201, res)
  } catch (err) {
    console.error('Setup error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ==========================================
// POST /api/auth/login
// Login using name + password (no email needed)
// ==========================================
router.post('/login', async (req, res) => {
  try {
    const { name, password } = req.body

    if (!name || !password)
      return res.status(400).json({ success: false, message: 'Name and password are required.' })

    // Find user by name (case-insensitive search)
    const user = await User.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    }).select('+password')

    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid name or password.' })

    if (!user.isActive)
      return res.status(401).json({ success: false, message: 'Account deactivated. Contact your admin.' })

    user.lastLogin = new Date()
    await user.save({ validateBeforeSave: false })

    sendToken(user, 200, res)
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ==========================================
// GET /api/auth/me — get my profile
// ==========================================
router.get('/me', protect, (req, res) => {
  res.json({
    success: true,
    user: {
      id:             req.user._id,
      name:           req.user.name,
      email:          req.user.email,
      role:           req.user.role,
      department:     req.user.department,
      allowedModules: req.user.allowedModules,
      assignedTasks:  req.user.assignedTasks,
      lastLogin:      req.user.lastLogin,
      createdAt:      req.user.createdAt,
    },
  })
})

// ==========================================
// GET /api/auth/users — list all users
// All authenticated users
// ==========================================
router.get('/users', protect, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 })
    res.json({ success: true, count: users.length, users })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ==========================================
// POST /api/auth/users — create a new user
// SUPER ADMIN only — no public signup exists
// ==========================================
router.post('/users', protect, async (req, res) => {
  try {
    const { name, password, role, department, allowedModules, assignedTasks } = req.body

    if (!name || !password)
      return res.status(400).json({ success: false, message: 'Name and password are required.' })
    if (password.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' })

    // Check if name already taken
    const exists = await User.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } })
    if (exists)
      return res.status(400).json({ success: false, message: 'A user with this name already exists.' })

    const user = await User.create({
      name:           name.trim(),
      email:          `${name.trim().toLowerCase().replace(/\s+/g, '.')}@system.local`,
      password,
      role:           role           || 'department_user',
      department:     department     || '',
      allowedModules: allowedModules || [],
      assignedTasks:  assignedTasks  || [],
    })

    user.password = undefined
    res.status(201).json({ success: true, user })
  } catch (err) {
    console.error('Create user error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ==========================================
// PUT /api/auth/users/:id/role — update role
// SUPER ADMIN only
// ==========================================
router.put('/users/:id/role', protect, async (req, res) => {
  try {
    const { role, department, allowedModules, assignedTasks } = req.body

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role, department, allowedModules, assignedTasks },
      { new: true, runValidators: true }
    ).select('-password')

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' })
    res.json({ success: true, user })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ==========================================
// DELETE /api/auth/users/:id — permanently delete a user
// SUPER ADMIN only
// ==========================================
router.delete('/users/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' })

    if (user._id.toString() === req.user._id.toString())
      return res.status(400).json({ success: false, message: 'Cannot delete your own account.' })

    await User.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'User deleted.' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ==========================================
// PUT /api/auth/users/:id/toggle — activate/deactivate
// SUPER ADMIN only
// ==========================================
router.put('/users/:id/toggle', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' })

    if (user._id.toString() === req.user._id.toString())
      return res.status(400).json({ success: false, message: 'Cannot deactivate your own account.' })

    user.isActive = !user.isActive
    await user.save({ validateBeforeSave: false })

    res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}.`, isActive: user.isActive })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

module.exports = router
