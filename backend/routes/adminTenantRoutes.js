const express = require('express')
const { protect, restrictTo } = require('../middleware/auth')
const { normalizeTenant } = require('../config/tenants')
const { getTenantsForApi, getTenantCatalog } = require('../config/tenantRegistry')

const router = express.Router()

function requireLoopcPlatformAdmin(req, res, next) {
  const tenant = normalizeTenant(req.tenant || req.user?.company)
  if (tenant !== 'loopc') {
    return res.status(403).json({ success: false, message: 'Tenant catalog admin is only available on the LoopC platform portal.' })
  }
  return next()
}

/** LoopC super_admin: view registered tenants and onboarding checklist (no secrets). */
router.get('/catalog', protect, restrictTo('super_admin'), requireLoopcPlatformAdmin, (_req, res) => {
  const catalog = getTenantCatalog()
  res.json({
    success: true,
    tenants: getTenantsForApi(),
    customDomains: catalog.customDomains || {},
    onboardingChecklist: [
      'Provision MongoDB URI (MONGO_URI_<CODE>) on Railway',
      'Add tenant to shared/tenant-catalog.json or TENANT_REGISTRY_JSON on Railway',
      'Add branding in frontend/src/config/tenantBranding.js',
      'Add Vercel alias: <code>.loopcstrategies.com',
      'Append portal URL to Railway CLIENT_URLS',
      'POST /api/auth/setup with company code (first admin)',
      'Run ERP seed scripts for the tenant',
      'Give customer: portal URL + Nexa mobile company code',
    ],
  })
})

module.exports = router
