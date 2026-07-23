/**
 * Cleanup endpoint for deleting bad exchange entries
 * POST /api/admin/cleanup/exchange-entries
 */

const express = require('express')
const { protect, restrictTo } = require('../middleware/auth')
const { connectTenant } = require('../db/tenantConnections')
const { isLocalDevEnv, isProductionEnv } = require('../utils/securityEnv')
const { timingSafeEqualString } = require('../utils/timingSafeEqualString')
const {
  planVendorRegistryMaintenance,
  applyVendorRegistryMaintenance,
} = require('../services/vendorRegistryMaintenance')
const router = express.Router()

function envBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue
  return String(value).trim().toLowerCase() === 'true'
}

function ensureCleanupRouteEnabled(req, res, next) {
  const enabledInProduction = envBool(process.env.ENABLE_ADMIN_CLEANUP_API, false)
  if (isProductionEnv() && !enabledInProduction) {
    return res.status(403).json({
      ok: false,
      error: 'Cleanup API is disabled in production. Set ENABLE_ADMIN_CLEANUP_API=true to allow it.',
    })
  }
  return next()
}

function requireCleanupConfirmationToken(req, res, next) {
  const expectedToken = String(process.env.CLEANUP_CONFIRM_TOKEN || '').trim()
  if (!expectedToken) {
    if (!isLocalDevEnv()) {
      return res.status(403).json({
        ok: false,
        error: 'Cleanup confirmation token is required outside local development.',
      })
    }
    return next()
  }

  const providedToken = String(req.headers['x-cleanup-token'] || req.body?.confirmToken || '').trim()
  if (!providedToken || !timingSafeEqualString(providedToken, expectedToken)) {
    return res.status(403).json({
      ok: false,
      error: 'Invalid or missing cleanup confirmation token.',
    })
  }
  return next()
}

async function resolveTenantDb(req) {
  const tenant = req.tenant || req.user?.company || req.headers['x-tenant'] || req.headers['x-company']
  const connection = await connectTenant(tenant)

  if (!connection || !connection.db) {
    throw new Error('No tenant database connection available')
  }

  return connection.db
}

router.use(protect)
router.use(restrictTo('super_admin'))
router.use(ensureCleanupRouteEnabled)
router.use(requireCleanupConfirmationToken)

router.post('/maintenance/vendor-registry', async (req, res) => {
  try {
    const db = await resolveTenantDb(req)
    const dryRun = req.body?.dryRun !== false && req.body?.apply !== true
    const purgeDeleted = req.body?.purgeDeleted !== false
    const removePlaceholders = req.body?.removePlaceholders !== false

    const plan = await planVendorRegistryMaintenance(db, { purgeDeleted, removePlaceholders })

    if (plan.blockedRemovals.length) {
      return res.status(400).json({
        ok: false,
        error: 'Vendor registry maintenance blocked for vendors with ledger or transaction activity',
        plan,
      })
    }

    if (dryRun) {
      return res.json({
        ok: true,
        mode: 'dry_run',
        plan,
      })
    }

    const result = await applyVendorRegistryMaintenance(db, plan)
    return res.json({
      ok: true,
      mode: 'apply',
      plan,
      result,
    })
  } catch (error) {
    console.error('[Vendor registry maintenance]', error.message)
    return res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
})

module.exports = router
