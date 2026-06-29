const mongoose = require('mongoose')
const { TENANT_KEYS, getTenantUri, getDefaultTenant } = require('../config/tenants')
const { connectTenant } = require('../db/tenantConnections')
const { runWithTenantConnection } = require('../db/tenantModelProxy')
const { isHardenedEnv } = require('../utils/securityEnv')

/**
 * Runs an async callback once per tenant that has a configured Mongo URI.
 * Callback receives the normalized tenant key (e.g. loopc). Model queries inside
 * must run while this promise is resolving (uses runWithTenantConnection).
 *
 * In hardened environments, skips the default mongoose.connection fallback when
 * no tenant URIs are configured — jobs must use runWithTenantConnection per tenant.
 */
async function forEachConfiguredTenantTaskDb(fn) {
  let sweptDedicated = 0
  for (const tenantKey of TENANT_KEYS) {
    if (!getTenantUri(tenantKey)) continue
    try {
      const connection = await connectTenant(tenantKey)
      await runWithTenantConnection(connection, tenantKey, () => fn(tenantKey))
      sweptDedicated += 1
    } catch (e) {
      console.warn(`[tenantTaskSweep] ${tenantKey}:`, e.message)
    }
  }
  if (sweptDedicated === 0) {
    if (isHardenedEnv()) {
      console.error('[tenantTaskSweep] No tenant Mongo URIs configured; skipping sweep (hardened env requires tenant DB context)')
      return
    }
    const defaultKey = getDefaultTenant()
    try {
      await runWithTenantConnection(mongoose.connection, defaultKey, () => fn(defaultKey))
    } catch (e) {
      console.warn(`[tenantTaskSweep] default (${defaultKey}):`, e.message)
    }
  }
}

module.exports = { forEachConfiguredTenantTaskDb }
