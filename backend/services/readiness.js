const mongoose = require('mongoose')
const { TENANT_KEYS, getTenantUri } = require('../config/tenants')
const { connectTenant } = require('../db/tenantConnections')
const { getBackendBuildMeta } = require('./buildMeta')

let primaryMongoReady = false

function setPrimaryMongoReady(value) {
  primaryMongoReady = Boolean(value)
}

async function pingTenantDatabases() {
  const tenants = {}

  for (const tenant of TENANT_KEYS) {
    const uri = getTenantUri(tenant)
    if (!uri) {
      tenants[tenant] = { configured: false, ready: null }
      continue
    }

    try {
      const connection = await connectTenant(tenant)
      await connection.db.admin().command({ ping: 1 })
      tenants[tenant] = { configured: true, ready: true }
    } catch (err) {
      tenants[tenant] = {
        configured: true,
        ready: false,
        error: String(err?.message || err),
      }
    }
  }

  return tenants
}

async function getReadinessStatus() {
  const jwtSecret = Boolean(String(process.env.JWT_SECRET || '').trim())
  const mongoConnected = mongoose.connection.readyState === 1 && primaryMongoReady
  const tenants = await pingTenantDatabases()
  const configuredTenants = Object.values(tenants).filter((entry) => entry.configured)
  const allTenantsReady = configuredTenants.length > 0
    && configuredTenants.every((entry) => entry.ready === true)
  const ready = jwtSecret && mongoConnected && allTenantsReady

  const expoPushAccessTokenSet = Boolean(String(process.env.EXPO_ACCESS_TOKEN || '').trim())
  const webPushVapidKeysSet = Boolean(
    String(process.env.WEB_PUSH_PUBLIC_KEY || '').trim()
      && String(process.env.WEB_PUSH_PRIVATE_KEY || '').trim(),
  )
  const redisConfigured = Boolean(String(process.env.REDIS_URL || '').trim())
  const isProduction = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production'
  const sentryConfigured = Boolean(String(process.env.SENTRY_DSN || '').trim())
  const build = getBackendBuildMeta()

  const warnings = []
  if (isProduction && !redisConfigured) {
    warnings.push('REDIS_URL is not set — multi-instance deploys need Redis for rate limits and realtime fan-out.')
  }
  if (isProduction && !sentryConfigured) {
    warnings.push('SENTRY_DSN is not set — production errors will not be reported to Sentry.')
  }

  return {
    success: ready,
    ready,
    commit: build.commit,
    build,
    backend: build,
    warnings,
    checks: {
      jwtSecret,
      mongoConnected,
      tenants,
      redisConfigured,
      redisRecommended: isProduction,
      sentryConfigured,
      integrations: {
        /** Expo server push: `expo-server-sdk` uses `EXPO_ACCESS_TOKEN` (never the secret value here). */
        expoPushAccessTokenSet,
        /** Browser Web Push: both VAPID env vars set on the API. */
        webPushVapidKeysSet,
      },
    },
    time: new Date(),
  }
}

module.exports = {
  setPrimaryMongoReady,
  getReadinessStatus,
}
