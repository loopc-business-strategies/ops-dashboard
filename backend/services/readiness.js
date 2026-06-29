const mongoose = require('mongoose')
const { isWeakJwtSecret } = require('../utils/envValidation')
const { TENANT_KEYS, getTenantUri } = require('../config/tenants')
const { connectTenant } = require('../db/tenantConnections')
const { getBackendBuildMeta } = require('./buildMeta')
const { getUploadStorageStatus } = require('./uploadStorage')
const { pingRedis } = require('../utils/sharedCoordination')

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
  const jwtSecret = !isWeakJwtSecret(process.env.JWT_SECRET)
  const mongoConnected = mongoose.connection.readyState === 1 && primaryMongoReady
  const tenants = await pingTenantDatabases()
  const configuredTenants = Object.values(tenants).filter((entry) => entry.configured)
  const allTenantsReady = configuredTenants.length > 0
    && configuredTenants.every((entry) => entry.ready === true)
  const redisBlocksReady = isProduction && redisConfigured && redisReady !== true
  const ready = jwtSecret && mongoConnected && allTenantsReady && !redisBlocksReady

  const expoPushAccessTokenSet = Boolean(String(process.env.EXPO_ACCESS_TOKEN || '').trim())
  const webPushVapidKeysSet = Boolean(
    String(process.env.WEB_PUSH_PUBLIC_KEY || '').trim()
      && String(process.env.WEB_PUSH_PRIVATE_KEY || '').trim(),
  )
  const redisStatus = await pingRedis()
  const redisConfigured = redisStatus.configured
  const redisReady = redisStatus.ready
  const isProduction = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production'
  const sentryConfigured = Boolean(String(process.env.SENTRY_DSN || '').trim())
  const uploadStorage = getUploadStorageStatus()
  const build = getBackendBuildMeta()

  const warnings = []
  if (isProduction && !redisConfigured) {
    warnings.push('REDIS_URL is not set — multi-instance deploys need Redis for rate limits and realtime fan-out.')
  }
  if (isProduction && redisConfigured && redisReady === false) {
    warnings.push('REDIS_URL is set but Redis ping failed — rate limits and realtime fan-out may be inconsistent.')
  }
  if (isProduction && !sentryConfigured) {
    warnings.push('SENTRY_DSN is not set — production errors will not be reported to Sentry.')
  }
  if (isProduction && uploadStorage.uploadStorageRecommended && !uploadStorage.uploadStorageRootSet) {
    warnings.push('UPLOAD_STORAGE_ROOT is not set — uploads are ephemeral and lost on redeploy.')
  }
  if (isProduction && uploadStorage.uploadStorageRootSet && !uploadStorage.uploadStorageWritable) {
    warnings.push('UPLOAD_STORAGE_ROOT is not writable — file uploads will fail.')
  }
  if (isProduction && uploadStorage.volumeMountPath && !uploadStorage.volumeAligned) {
    warnings.push(`UPLOAD_STORAGE_ROOT does not match RAILWAY_VOLUME_MOUNT_PATH (${uploadStorage.volumeMountPath}).`)
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
      redisReady,
      redisRecommended: isProduction,
      sentryConfigured,
      uploadStorageRootSet: uploadStorage.uploadStorageRootSet,
      uploadStorageWritable: uploadStorage.uploadStorageWritable,
      uploadVolumeAligned: uploadStorage.volumeAligned,
      uploadStorageRecommended: uploadStorage.uploadStorageRecommended,
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
