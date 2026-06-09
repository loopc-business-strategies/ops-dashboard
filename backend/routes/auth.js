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
//   POST /api/auth/me/push-token    ← register Expo push token (mobile)
//   DELETE /api/auth/me/push-token  ← remove Expo push token
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
const {
  loadAdminSettings,
  validatePasswordPolicy,
  resolveSessionMaxAgeMs,
  resolveJwtExpiresIn,
} = require('../services/adminSettings')
const { isLikelyExpoPushToken } = require('../services/expoPushNotifications')

const router = express.Router()

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function resolveRequestTenant(req, requestedCompany) {
  // Priority: 1) hostname subdomain, 2) x-tenant header, 3) posted company field, 4) default
  const headerTenant = normalizeTenant(req.headers['x-tenant'] || req.headers['x-company'])
  const fallback = normalizeTenant(requestedCompany) || headerTenant || getDefaultTenant()
  return resolveTenantFromHost(req.hostname, fallback)
}

// Helper: create a JWT token for a user
const createToken = (id, company, expiresIn = process.env.JWT_EXPIRES_IN || '7d') =>
  jwt.sign({ id, company }, process.env.JWT_SECRET, { expiresIn })

const clearSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
}
const buildSessionCookieOptions = (maxAgeMs) => ({
  ...clearSessionCookieOptions,
  maxAge: maxAgeMs,
})

// Helper: send user data + token as response
const isMobileClientRequest = (req) => {
  const client = String(req?.headers?.['x-client'] || req?.headers?.['X-Client'] || '').trim().toLowerCase()
  return client === 'mobile' || client === 'mg-mobile'
}

const sendToken = async (user, status, res, company, req = null) => {
  const tenant = normalizeTenant(company) || getDefaultTenant()
  const settings = await loadAdminSettings(tenant)
  const maxAgeMs = resolveSessionMaxAgeMs(settings)
  const expiresIn = resolveJwtExpiresIn(maxAgeMs)
  const token = createToken(user._id, tenant, expiresIn)
  const mobile = Boolean(req && isMobileClientRequest(req))

  // Mobile uses Bearer + SecureStore only. Avoid Set-Cookie sessionToken: native fetch may persist
  // it and then mutating /api/* hits CSRF (session cookie without x-csrf-token from the app).
  let csrfToken = null
  if (!mobile) {
    res.cookie('sessionToken', token, buildSessionCookieOptions(maxAgeMs))
    csrfToken = generateCsrfToken()
    setCsrfCookie(res, csrfToken)
    res.setHeader('X-CSRF-Token', csrfToken)
  }
  user.password = undefined // never send password
  const payload = {
    success: true,
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
  }
  if (!mobile && csrfToken) payload.csrfToken = csrfToken
  if (mobile) {
    payload.token = token
    payload.expiresIn = expiresIn
  }
  res.status(status).json(payload)
}

const validatePasswordForTenant = async (tenant, password) => {
  const settings = await loadAdminSettings(tenant)
  return validatePasswordPolicy(password, settings.passwordPolicy)
}

const setupSchema = Joi.object({
  company: Joi.string().trim().valid('mg', 'cg', 'loopc').optional(),
  name: Joi.string().trim().min(2).max(80).required(),
  password: Joi.string().min(6).max(128).required(),
  setupToken: Joi.string().trim().max(256).optional(),
})

const loginSchema = Joi.object({
  company: Joi.string().trim().valid('mg', 'cg', 'loopc').optional(),
  name: Joi.string().trim().min(2).max(80).required(),
  password: Joi.string().min(1).max(128).required(),
})

const expoPushTokenSchema = Joi.object({
  token: Joi.string().trim().min(24).max(512).required(),
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

// ==========================================
// POST /api/auth/setup
// Creates the FIRST Super Admin account.
// Only works when database has zero users.
// After first use, this endpoint is permanently blocked.
// ==========================================
router.post('/setup', validateBody(setupSchema), async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      const enabled = String(process.env.ENABLE_SETUP || '').trim().toLowerCase() === 'true'
      if (!enabled) {
        return res.status(403).json({ success: false, message: 'Setup is disabled in production.' })
      }

      const expectedToken = String(process.env.SETUP_TOKEN || '').trim()
      const providedToken = String(
        req.headers['x-setup-token']
        || req.body?.setupToken
        || ''
      ).trim()

      if (!expectedToken || providedToken !== expectedToken) {
        return res.status(403).json({ success: false, message: 'Invalid or missing setup token.' })
      }
    }

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
    const passwordError = await validatePasswordForTenant(tenant, password)
    if (passwordError)
      return res.status(400).json({ success: false, message: passwordError })

    // Create super admin — use name as login identifier (no email needed)
    const user = await TenantUser.create({
      name:  name.trim(),
      email: `${name.trim().toLowerCase().replace(/\s+/g, '.')}@system.local`,
      password,
      role: 'super_admin',
    })

    await sendToken(user, 201, res, tenant, req)
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

    await sendToken(user, 200, res, tenant, req)
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ==========================================
// GET /api/auth/me — get my profile
// ==========================================
router.get('/me', protect, (req, res) => {
  const mobile = isMobileClientRequest(req)
  let csrfToken = null
  if (!mobile) {
    // Reuse the existing cookie token when present so parallel /me calls (e.g. React Strict Mode)
    // or a slow first response cannot rotate the cookie out from under the axios default header.
    const existing = String(req.cookies?.csrfToken || '').trim()
    if (existing) {
      csrfToken = existing
      res.setHeader('X-CSRF-Token', csrfToken)
    } else {
      csrfToken = generateCsrfToken()
      setCsrfCookie(res, csrfToken)
      res.setHeader('X-CSRF-Token', csrfToken)
    }
  }
  res.json({
    success: true,
    ...(csrfToken ? { csrfToken } : {}),
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

// ==========================================
// POST /api/auth/me/push-token — register Expo push token (mobile)
// ==========================================
router.post('/me/push-token', protect, validateBody(expoPushTokenSchema), async (req, res) => {
  try {
    const token = String(req.body.token).trim()
    if (!isLikelyExpoPushToken(token)) {
      return res.status(400).json({ success: false, message: 'Invalid Expo push token format.' })
    }
    const TenantUser = await User.getTenantModel(req.tenant)
    const user = await TenantUser.findById(req.user._id)
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' })

    const existing = Array.isArray(user.expoPushTokens)
      ? user.expoPushTokens.map((e) => ({ token: String(e.token || ''), updatedAt: e.updatedAt || new Date() }))
      : []
    const deduped = existing.filter((e) => e.token && e.token !== token)
    deduped.unshift({ token, updatedAt: new Date() })
    user.expoPushTokens = deduped.slice(0, 8)
    await user.save({ validateBeforeSave: false })
    res.json({ success: true })
  } catch (err) {
    console.error('Push token registration error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

// ==========================================
// DELETE /api/auth/me/push-token — remove token (e.g. on logout)
// ==========================================
router.delete('/me/push-token', protect, validateBody(expoPushTokenSchema), async (req, res) => {
  try {
    const token = String(req.body.token).trim()
    const TenantUser = await User.getTenantModel(req.tenant)
    const user = await TenantUser.findById(req.user._id)
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' })
    user.expoPushTokens = (user.expoPushTokens || []).filter((e) => String(e?.token || '') !== token)
    await user.save({ validateBeforeSave: false })
    res.json({ success: true })
  } catch (err) {
    console.error('Push token delete error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
})

router.post('/logout', protect, (req, res) => {
  res.clearCookie('sessionToken', clearSessionCookieOptions)
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
      res.clearCookie('sessionToken', clearSessionCookieOptions)
      return res.status(401).json({ success: false, message: 'Session revoked.' })
    }
    const settings = await loadAdminSettings(req.tenant)
    const maxAgeMs = resolveSessionMaxAgeMs(settings)
    const expiresIn = resolveJwtExpiresIn(maxAgeMs)
    const token = createToken(user._id, req.tenant, expiresIn)
    res.cookie('sessionToken', token, buildSessionCookieOptions(maxAgeMs))
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
    const passwordError = await validatePasswordForTenant(req.tenant, password)
    if (passwordError)
      return res.status(400).json({ success: false, message: passwordError })

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
    if (password) {
      const passwordError = await validatePasswordForTenant(req.tenant, password)
      if (passwordError)
        return res.status(400).json({ success: false, message: passwordError })
      user.password = password
    }

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
  modulePermissions: Joi.object()
    .pattern(
      Joi.string().valid(
        'overview',
        'chat',
        'admin',
        'production',
        'hr',
        'finance',
        'government',
        'sales',
        'operations',
        'training',
        'procurement-plus',
        'erp'
      ),
      Joi.object({
        on: Joi.boolean().required(),
        view: Joi.boolean().optional(),
        edit: Joi.boolean().optional(),
        subs: Joi.object()
          .pattern(
            Joi.string().valid(
              'dashboard',
              'accounts',
              'mappings',
              'settings',
              'currencies',
              'enquiry',
              'customers',
              'customer-margin',
              'supplier-margin',
              'ledger',
              'transactions',
              'reports',
              'vendors',
              'inventory',
              'vouchers',
              'direct-deals',
              'fixing-register'
            ),
            Joi.object({
              on: Joi.boolean().optional(),
              view: Joi.boolean().optional(),
              edit: Joi.boolean().optional(),
            }).min(1).unknown(false)
          )
          .unknown(false)
          .optional(),
      }).min(1).unknown(false)
    )
    .unknown(false)
    .required(),
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
