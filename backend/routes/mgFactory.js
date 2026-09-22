const express = require('express')
const Joi = require('joi')
const User = require('../models/User')
const { protect } = require('../middleware/auth')
const { requireMgTenant } = require('../middleware/requireMgTenant')
const { validateBody } = require('../middleware/validate')
const { requireProductionPermission } = require('../services/productionControl/permissions')
const mgFactory = require('../services/mgFactory')

const router = express.Router()

function handleError(res, err) {
  const status = err.statusCode || err.status || 500
  const code = status >= 500 ? 500 : status
  if (code >= 500) console.error('[mg-factory]', err)
  return res.status(code).json({
    success: false,
    message: err.message || 'MG Factory error',
    code: err.code || undefined,
  })
}

/**
 * Department kiosk JWT (no user id). Used only for employee login handoff.
 */
async function requireDepartmentSession(req, res, next) {
  try {
    const token = mgFactory.readBearer(req)
    if (!token) {
      return res.status(401).json({ success: false, message: 'Department session required.' })
    }
    const decoded = mgFactory.verifyToken(token)
    if (decoded.typ !== mgFactory.DEPT_TOKEN_TYP || String(decoded.company).toLowerCase() !== 'mg') {
      return res.status(401).json({ success: false, message: 'Invalid department session.' })
    }
    if (!decoded.departmentKey) {
      return res.status(401).json({ success: false, message: 'Invalid department session.' })
    }
    req.tenant = 'mg'
    req.mgFactoryDepartment = {
      departmentKey: String(decoded.departmentKey).toLowerCase(),
      departmentLabel: decoded.departmentLabel || decoded.departmentKey,
    }
    return next()
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired department session.' })
  }
}

/**
 * Employee JWT with mgf_emp typ + departmentKey. Uses protect for user load,
 * then asserts factory claims.
 */
async function requireFactoryEmployee(req, res, next) {
  try {
    const token = mgFactory.readBearer(req)
    if (!token) {
      return res.status(401).json({ success: false, message: 'Please log in to access this.' })
    }
    let decoded
    try {
      decoded = mgFactory.verifyToken(token)
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired session.' })
    }
    if (decoded.typ !== mgFactory.EMP_TOKEN_TYP || String(decoded.company).toLowerCase() !== 'mg') {
      return res.status(401).json({ success: false, message: 'MG Factory employee session required.' })
    }
    if (!decoded.id || !decoded.departmentKey) {
      return res.status(401).json({ success: false, message: 'Invalid employee session.' })
    }

    const tenantUserModel = await User.getTenantModel('mg')
    const user = await tenantUserModel.findById(decoded.id).select('-expoPushTokens -webPushSubscriptions')
    if (!user || user.isDeleted) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' })
    }
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account has been deactivated.' })
    }

    req.tenant = 'mg'
    req.user = user
    req.mgFactoryDepartment = {
      departmentKey: String(decoded.departmentKey).toLowerCase(),
      departmentLabel: decoded.departmentLabel || decoded.departmentKey,
    }
    req.authJwt = decoded
    return next()
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session.' })
  }
}

const factoryProtect = [requireFactoryEmployee, requireMgTenant]

// ── Department unlock (public) ─────────────────────
router.post(
  '/department/login',
  validateBody(
    Joi.object({
      departmentKey: Joi.string().trim().min(1).max(64).required(),
      password: Joi.string().min(1).max(200).required(),
    }),
  ),
  async (req, res) => {
    try {
      const result = await mgFactory.departmentLogin(req.body)
      res.json({ success: true, ...result })
    } catch (err) {
      handleError(res, err)
    }
  },
)

router.post(
  '/department/set-password',
  protect,
  requireMgTenant,
  requireProductionPermission('manageFlow'),
  validateBody(
    Joi.object({
      departmentKey: Joi.string().trim().min(1).max(64).required(),
      password: Joi.string().min(4).max(200).required(),
      label: Joi.string().trim().max(120).allow('', null),
    }),
  ),
  async (req, res) => {
    try {
      const result = await mgFactory.setDepartmentPassword(req, req.body)
      res.json({ success: true, ...result })
    } catch (err) {
      handleError(res, err)
    }
  },
)

// ── Employee login (department JWT) ────────────────
router.post(
  '/employee/login',
  requireDepartmentSession,
  validateBody(
    Joi.object({
      name: Joi.string().trim().min(1).max(120).required(),
      password: Joi.string().min(1).max(200).required(),
    }),
  ),
  async (req, res) => {
    try {
      const result = await mgFactory.employeeLogin(req, req.body)
      res.json({ success: true, ...result })
    } catch (err) {
      handleError(res, err)
    }
  },
)

router.post('/employee/biometric-token', ...factoryProtect, async (req, res) => {
  try {
    const result = await mgFactory.issueBiometricToken(req)
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/me', ...factoryProtect, async (req, res) => {
  try {
    const me = await mgFactory.getMe(req)
    res.json({ success: true, ...me })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/departments', ...factoryProtect, async (req, res) => {
  try {
    const departments = await mgFactory.listDepartments()
    res.json({ success: true, departments })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/jobs', ...factoryProtect, async (req, res) => {
  try {
    const result = await mgFactory.listJobs(req)
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.post(
  '/metal/in',
  ...factoryProtect,
  validateBody(
    Joi.object({
      passId: Joi.string().trim().min(1).max(120).required(),
      receivedWeight: Joi.number().positive().required(),
      varianceReason: Joi.string().trim().allow(''),
      operationId: Joi.string().trim().max(120).allow('', null),
      expectedBatchVersion: Joi.number().integer().min(0),
    }).unknown(true),
  ),
  async (req, res) => {
    try {
      const result = await mgFactory.metalIn(req, req.body)
      res.status(result.reused ? 200 : 201).json({ success: true, ...result })
    } catch (err) {
      handleError(res, err)
    }
  },
)

router.post(
  '/metal/out',
  ...factoryProtect,
  validateBody(
    Joi.object({
      batchId: Joi.string().trim().min(1).max(120).required(),
      toDepartment: Joi.string().trim().required(),
      weight: Joi.number().positive().required(),
      purpose: Joi.string().trim().allow(''),
      operationId: Joi.string().trim().max(120).allow('', null),
    }).unknown(true),
  ),
  async (req, res) => {
    try {
      const result = await mgFactory.metalOut(req, req.body)
      res.status(result.reused ? 200 : 201).json({ success: true, ...result })
    } catch (err) {
      handleError(res, err)
    }
  },
)

router.post(
  '/call-manager',
  ...factoryProtect,
  validateBody(
    Joi.object({
      message: Joi.string().trim().max(500).allow('', null),
    }).unknown(true),
  ),
  async (req, res) => {
    try {
      const result = await mgFactory.callManager(req, req.body || {})
      res.status(201).json({ success: true, ...result })
    } catch (err) {
      handleError(res, err)
    }
  },
)

module.exports = router
