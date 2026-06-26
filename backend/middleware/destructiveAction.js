const { isLocalDevEnv, isProductionEnv } = require('../utils/securityEnv')

function envBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue
  return String(value).trim().toLowerCase() === 'true'
}

function resolveReason(req) {
  return String(req.body?.reason || req.body?.comment || req.headers['x-destructive-reason'] || '').trim()
}

function requireDestructiveAdminGuard(actionName) {
  return (req, res, next) => {
    if (!isLocalDevEnv() && !envBool(process.env.ENABLE_DESTRUCTIVE_ADMIN_API, false)) {
      return res.status(403).json({
        success: false,
        message: 'Destructive admin API is disabled. Set ENABLE_DESTRUCTIVE_ADMIN_API=true to allow it.',
      })
    }

    const normalizedActionName = String(actionName || '').toLowerCase()
    const isPermanentDeleteAction = /hard-delete|permanent-delete|permanent/.test(normalizedActionName)
    if (
      isProductionEnv() &&
      isPermanentDeleteAction &&
      !envBool(process.env.ENABLE_PERMANENT_DELETE_API, false)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Permanent delete API is disabled in production. Set ENABLE_PERMANENT_DELETE_API=true only for an approved maintenance window.',
      })
    }

    const expectedToken = String(
      process.env.DESTRUCTIVE_ADMIN_CONFIRM_TOKEN ||
      process.env.CLEANUP_CONFIRM_TOKEN ||
      ''
    ).trim()

    if (!expectedToken) {
      return res.status(500).json({
        success: false,
        message: 'Destructive admin confirmation token is not configured.',
      })
    }

    const providedToken = String(
      req.headers['x-destructive-token'] ||
      req.headers['x-cleanup-token'] ||
      req.body?.confirmToken ||
      ''
    ).trim()

    if (providedToken !== expectedToken) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or missing destructive action confirmation token.',
      })
    }

    const reason = resolveReason(req)
    if (reason.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'A destructive action reason/comment of at least 8 characters is required.',
      })
    }

    req.destructiveAction = {
      name: actionName,
      reason,
      confirmedAt: new Date(),
    }

    return next()
  }
}

module.exports = {
  requireDestructiveAdminGuard,
}
