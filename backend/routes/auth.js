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
const { Joi, validateBody, validateParams } = require('../middleware/validate')
const { normalizeTenant, getDefaultTenant, resolveTenantFromHost } = require('../config/tenants')
const { setCsrfCookie, clearCsrfCookie, generateCsrfToken } = require('../middleware/csrf')

const router = express.Router()

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function resolveRequestTenant(req, requestedCompany) {
  // Priority: 1) hostname subdomain, 2) x-tenant header, 3) posted company field, 4) default
  const headerTenant = normalizeTenant(req.headers['x-tenant'] || req.headers['x-company'])
  const fallback = normalizeTenant(requestedCompany) || headerTenant || getDefaultTenant()
  return resolveTenantFromHost(req.hostname, fallback)
}

// Helper: create a JWT token for a user
const createToken = (id, company) =>
  jwt.sign({ id, company }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })

const COOKIE_MAX_AGE = Number(process.env.COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000)

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: COOKIE_MAX_AGE,
  path: '/',
}

const setupSchema = Joi.object({
  company: Joi.string().trim().valid('mg', 'cg', 'loopc').optional(),
  name: Joi.string().trim().min(2).max(80).required(),
  password: Joi.string().min(6).max(128).required(),
})

const loginSchema = Joi.object({
  company: Joi.string().trim().valid('mg', 'cg', 'loopc').optional(),
  name: Joi.string().trim().min(2).max(80).required(),
  password: Joi.string().min(1).max(128).required(),
})

const userIdParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
})

const createUserSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  password: Joi.string().min(6).max(128).required(),
  role: Joi.string().valid('super_admin', 'management', 'department_head', 'department_user', 'external').optional(),
  department: Joi.string().allow('').max(80).optional(),
  allowedModules: Joi.array().items(Joi.string().trim().max(80)).max(30).optional(),
  assignedTasks: Joi.array().items(Joi.string().trim().max(120)).max(200).optional(),
  fullName: Joi.string().allow('').trim().max(120).optional(),
  title: Joi.string().allow('').trim().max(80).optional(),
  phone: Joi.string().allow('').trim().max(40).optional(),
  location: Joi.string().allow('').trim().max(120).optional(),
  timezone: Joi.string().allow('').trim().max(80).optional(),
  employeeCode: Joi.string().allow('').trim().max(40).optional(),
  notes: Joi.string().allow('').trim().max(600).optional(),
})

const updateRoleSchema = Joi.object({
  role: Joi.string().valid('super_admin', 'management', 'department_head', 'department_user', 'external').required(),
  department: Joi.string().allow('').max(80).optional(),
  allowedModules: Joi.array().items(Joi.string().trim().max(80)).max(30).optional(),
  assignedTasks: Joi.array().items(Joi.string().trim().max(120)).max(200).optional(),
  name: Joi.string().trim().min(2).max(80).optional(),
  fullName: Joi.string().allow('').trim().max(120).optional(),
  title: Joi.string().allow('').trim().max(80).optional(),
  phone: Joi.string().allow('').trim().max(40).optional(),
  location: Joi.string().allow('').trim().max(120).optional(),
  timezone: Joi.string().allow('').trim().max(80).optional(),
  employeeCode: Joi.string().allow('').trim().max(40).optional(),
  notes: Joi.string().allow('').trim().max(600).optional(),
  password: Joi.string().min(6).max(128).allow('').optional(),
})

// Helper: send user data + token as response
const sendToken = (user, status, res, company) => {
  const tenant = normalizeTenant(company) || getDefaultTenant()
  const token = createToken(user._id, tenant)
  res.cookie('sessionToken', token, cookieOptions)
  const csrfToken = generateCsrfToken()
  setCsrfCookie(res, csrfToken)
  // Also send CSRF token in response body so cross-domain frontends can store and use it
  res.setHeader('X-CSRF-Token', csrfToken)
  user.password = undefined // never send password
  res.status(status).json({
    success: true,
    csrfToken,
    user: {
      id:             user._id,
      name:           user.name,
      fullName:       user.fullName,
      email:          user.email,
      role:           user.role,
      department:     user.department,
      allowedModules: user.allowedModules,
      assignedTasks:  user.assignedTasks,
      title:          user.title,
      phone:          user.phone,
      location:       user.location,
      timezone:       user.timezone,
      employeeCode:   user.employeeCode,
      notes:          user.notes,
      modulePermissions: user.modulePermissions,
      company: tenant,
    },
  })
}

// ==========================================
// POST /api/auth/setup
// Creates the FIRST Super Admin account.
// Only works when database has zero users.
// After first use, this endpoint is permanently blocked.
// ==========================================
router.post('/setup', validateBody(setupSchema), async (req, res) => {
  try {
    const tenant = resolveRequestTenant(req, req.body.company)
    if (!tenant) {
      return res.status(400).json({ success: false, message: 'Valid company could not be resolved.' })
    }

    const TenantUser = await User.getTenantModel(tenant)
    const count = await TenantUser.countDocuments()
    if (count > 0) {
      return res.status(400).json({
        success: false,
        message: `Setup already done for ${tenant.toUpperCase()}. Super Admin already exists.`,
      })
    }

    const { name, password } = req.body
    if (!name || !password)
      return res.status(400).json({ success: false, message: 'Name and password are required.' })
    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' })

    // Create super admin — use name as login identifier (no email needed)
    const user = await TenantUser.create({
      name:  name.trim(),
      email: `${name.trim().toLowerCase().replace(/\s+/g, '.')}@system.local`,
      password,
      role: 'super_admin',
    })

    sendToken(user, 201, res, tenant)
  } catch (err) {
    console.error('Setup error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ==========================================
// POST /api/auth/login
// Login using name + password (no email needed)
// ==========================================
router.post('/login', validateBody(loginSchema), async (req, res) => {
  try {
    const { company, name, password } = req.body
    const tenant = resolveRequestTenant(req, company)

    if (!tenant) {
      return res.status(400).json({ success: false, message: 'Valid company could not be resolved.' })
    }

    if (!name || !password)
      return res.status(400).json({ success: false, message: 'Username and password are required.' })

    // Find user by name (case-insensitive, schema-validated above)
    const safeName = escapeRegex(name.trim())
    const TenantUser = await User.getTenantModel(tenant)
    const user = await TenantUser.findOne({
      name: { $regex: new RegExp(`^${safeName}$`, 'i') }
    }).select('+password')

    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid credentials.' })

    if (!user.isActive)
      return res.status(401).json({ success: false, message: 'Account deactivated. Contact your admin.' })

    user.lastLogin = new Date()
    await user.save({ validateBeforeSave: false })

    sendToken(user, 200, res, tenant)
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ==========================================
// GET /api/auth/me — get my profile
// ==========================================
router.get('/me', protect, (req, res) => {
  // Always issue/refresh CSRF token so cross-domain frontends can store it
  const csrfToken = generateCsrfToken()
  setCsrfCookie(res, csrfToken)
  res.setHeader('X-CSRF-Token', csrfToken)
  res.json({
    success: true,
    csrfToken,
    user: {
      id:             req.user._id,
      name:           req.user.name,
      fullName:       req.user.fullName,
      email:          req.user.email,
      role:           req.user.role,
      department:     req.user.department,
      allowedModules: req.user.allowedModules,
      assignedTasks:  req.user.assignedTasks,
      title:          req.user.title,
      phone:          req.user.phone,
      location:       req.user.location,
      timezone:       req.user.timezone,
      employeeCode:   req.user.employeeCode,
      notes:          req.user.notes,
      modulePermissions: req.user.modulePermissions,
      company: req.tenant,
      lastLogin:      req.user.lastLogin,
      createdAt:      req.user.createdAt,
    },
  })
})

router.post('/logout', protect, (req, res) => {
  res.clearCookie('sessionToken', { ...cookieOptions, maxAge: undefined })
  clearCsrfCookie(res)
  res.json({ success: true, message: 'Logged out.' })
})

// ==========================================
// POST /api/auth/refresh
// Re-issues a fresh session token if the current
// token is valid and within the refresh window.
// Call this on app focus to silently extend sessions.
// ==========================================
router.post('/refresh', protect, async (req, res) => {
  try {
    // Verify user still exists and is active (already done by protect, but re-check freshness)
    const TenantUser = await User.getTenantModel(req.tenant)
    const user = await TenantUser.findById(req.user._id).select('-password')
    if (!user || !user.isActive) {
      res.clearCookie('sessionToken', { ...cookieOptions, maxAge: undefined })
      return res.status(401).json({ success: false, message: 'Session revoked.' })
    }
    // Issue a fresh token — effectively sliding the expiry window
    const token = createToken(user._id, req.tenant)
    res.cookie('sessionToken', token, cookieOptions)
    setCsrfCookie(res)
    res.json({ success: true, message: 'Session refreshed.' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ==========================================
// GET /api/auth/users — list all users
// All authenticated users
// ==========================================
router.get('/users', protect, restrictTo('super_admin'), async (req, res) => {
  try {
    const TenantUser = await User.getTenantModel(req.tenant)
    const users = await TenantUser.find({ isDeleted: { $ne: true } }).select('-password').sort({ createdAt: -1 })
    res.json({ success: true, count: users.length, users })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ==========================================
// POST /api/auth/users — create a new user
// SUPER ADMIN only — no public signup exists
// ==========================================
router.post('/users', protect, restrictTo('super_admin'), validateBody(createUserSchema), async (req, res) => {
  try {
    const { name, password, role, department, allowedModules, assignedTasks, fullName, title, phone, location, timezone, employeeCode, notes } = req.body

    if (!name || !password)
      return res.status(400).json({ success: false, message: 'Name and password are required.' })
    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' })

    const TenantUser = await User.getTenantModel(req.tenant)

    // Check if name already taken
    const safeName = escapeRegex(name.trim())
    const exists = await TenantUser.findOne({ name: { $regex: new RegExp(`^${safeName}$`, 'i') } })
    if (exists)
      return res.status(400).json({ success: false, message: 'A user with this name already exists.' })

    const user = await TenantUser.create({
      name:           name.trim(),
      email:          `${name.trim().toLowerCase().replace(/\s+/g, '.')}@system.local`,
      password,
      role:           role           || 'department_user',
      department:     department     || '',
      allowedModules: allowedModules || [],
      assignedTasks:  assignedTasks  || [],
      fullName:       fullName       || '',
      title:          title          || '',
      phone:          phone          || '',
      location:       location       || '',
      timezone:       timezone       || 'Africa/Johannesburg',
      employeeCode:   employeeCode   || '',
      notes:          notes          || '',
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
router.put('/users/:id/role', protect, restrictTo('super_admin'), validateParams(userIdParamSchema), validateBody(updateRoleSchema), async (req, res) => {
  try {
    const { role, department, allowedModules, assignedTasks, name, fullName, title, phone, location, timezone, employeeCode, notes, password } = req.body

    const TenantUser = await User.getTenantModel(req.tenant)
    const user = await TenantUser.findById(req.params.id).select('+password')

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' })

    if (name && name.trim().toLowerCase() !== user.name.toLowerCase()) {
      const safeName = escapeRegex(name.trim())
      const exists = await TenantUser.findOne({ _id: { $ne: user._id }, name: { $regex: new RegExp(`^${safeName}$`, 'i') } })
      if (exists)
        return res.status(400).json({ success: false, message: 'A user with this name already exists.' })
      user.name = name.trim()
      user.email = `${name.trim().toLowerCase().replace(/\s+/g, '.')}@system.local`
    }

    user.role = role
    user.department = department || ''
    user.allowedModules = allowedModules || []
    user.assignedTasks = assignedTasks || []
    user.fullName = fullName || ''
    user.title = title || ''
    user.phone = phone || ''
    user.location = location || ''
    user.timezone = timezone || 'Africa/Johannesburg'
    user.employeeCode = employeeCode || ''
    user.notes = notes || ''
    if (password) user.password = password

    await user.save()
    user.password = undefined

    res.json({ success: true, user })
  } catch (err) {
    console.error('Update user error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ==========================================
// DELETE /api/auth/users/:id — deactivate and soft-delete a user
// SUPER ADMIN only
// ==========================================
router.delete('/users/:id', protect, restrictTo('super_admin'), validateParams(userIdParamSchema), async (req, res) => {
  try {
    const TenantUser = await User.getTenantModel(req.tenant)
    const user = await TenantUser.findById(req.params.id)
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' })

    if (user._id.toString() === req.user._id.toString())
      return res.status(400).json({ success: false, message: 'Cannot delete your own account.' })

    const reason = String(req.body?.reason || req.body?.comment || '').trim()
    user.isActive = false
    user.isDeleted = true
    user.deletedAt = new Date()
    user.deletedBy = req.user._id
    user.deletedByName = req.user.name
    user.deletionReason = reason
    await user.save({ validateBeforeSave: false })
    res.json({ success: true, message: 'User deactivated and removed from active user list.' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ==========================================
// PUT /api/auth/users/:id/permissions — update granular module permissions
// SUPER ADMIN only
// ==========================================
const updatePermissionsSchema = Joi.object({
  modulePermissions: Joi.any().required(),
})

router.put('/users/:id/permissions', protect, restrictTo('super_admin'), validateParams(userIdParamSchema), validateBody(updatePermissionsSchema), async (req, res) => {
  try {
    const TenantUser = await User.getTenantModel(req.tenant)
    const user = await TenantUser.findById(req.params.id)
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' })

    user.modulePermissions = req.body.modulePermissions
    user.markModified('modulePermissions')
    await user.save({ validateBeforeSave: false })

    res.json({ success: true, message: 'Permissions updated.', modulePermissions: user.modulePermissions })
  } catch (err) {
    console.error('Update permissions error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ==========================================
// PUT /api/auth/users/:id/toggle — activate/deactivate
// SUPER ADMIN only
// ==========================================
router.put('/users/:id/toggle', protect, restrictTo('super_admin'), validateParams(userIdParamSchema), async (req, res) => {
  try {
    const TenantUser = await User.getTenantModel(req.tenant)
    const user = await TenantUser.findById(req.params.id)
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
