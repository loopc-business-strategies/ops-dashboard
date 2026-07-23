const { TENANT_KEYS } = require('../config/tenants')

const WEAK_JWT_PLACEHOLDERS = new Set([
  'change_this_to_a_strong_random_secret',
  'changeme',
  'secret',
  '<generate-a-random-32-char-string-with-node>',
  '<generate-staging-only-secret>',
])

const WEAK_BRIDGE_PLACEHOLDERS = new Set([
  'change-this-long-random-token',
])

const MIN_PRODUCTION_JWT_LENGTH = 32

const TENANT_URI_ENV = {
  mg: 'MONGO_URI_MG',
  cg: 'MONGO_URI_CG',
  loopc: 'MONGO_URI_LOOPC',
}

function normalizeNodeEnv() {
  return String(process.env.NODE_ENV || '').trim().toLowerCase()
}

function isProductionEnv() {
  return normalizeNodeEnv() === 'production'
}

function isStagingEnv() {
  return normalizeNodeEnv() === 'staging'
}

function isHardenedDeployEnv() {
  return isProductionEnv() || isStagingEnv()
}

function isWeakJwtSecret(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return true
  if (WEAK_JWT_PLACEHOLDERS.has(trimmed)) return true
  if (isHardenedDeployEnv() && trimmed === 'test-secret') return true
  if (isHardenedDeployEnv() && trimmed.length < MIN_PRODUCTION_JWT_LENGTH) return true
  return false
}

function isWeakBridgeToken(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return false
  return WEAK_BRIDGE_PLACEHOLDERS.has(trimmed)
}

function validateHardenedDeploySecrets() {
  const errors = []

  if (!isHardenedDeployEnv()) return errors

  if (isWeakJwtSecret(process.env.JWT_SECRET)) {
    errors.push(
      'JWT_SECRET is missing, too short, or uses a placeholder value. '
      + `Set a random secret of at least ${MIN_PRODUCTION_JWT_LENGTH} characters.`,
    )
  }

  if (!String(process.env.SERVER_BASE_URL || '').trim()) {
    errors.push('SERVER_BASE_URL is required in production and staging for attachment links.')
  }

  if (!String(process.env.UPLOAD_STORAGE_ROOT || '').trim()) {
    errors.push('UPLOAD_STORAGE_ROOT is required in production and staging for persistent attachments.')
  }

  const { getUploadStorageStatus } = require('../services/uploadStorage')
  const uploadStatus = getUploadStorageStatus()
  if (uploadStatus.root && !uploadStatus.uploadStorageWritable) {
    errors.push('UPLOAD_STORAGE_ROOT is not writable — file uploads will fail.')
  }

  for (const tenant of TENANT_KEYS) {
    const envVar = TENANT_URI_ENV[tenant]
    if (!String(process.env[envVar] || '').trim()) {
      errors.push(`${envVar} is required in production and staging (tenant: ${tenant}).`)
    }
  }

  const bridgeToken = String(process.env.METAL_RATES_BRIDGE_TOKEN || '').trim()
  if (bridgeToken && isWeakBridgeToken(bridgeToken)) {
    errors.push('METAL_RATES_BRIDGE_TOKEN uses a placeholder value — generate a unique secret.')
  }

  const oauthStateSecret = String(process.env.EMAIL_OAUTH_STATE_SECRET || '').trim()
  const emailTokenKey = String(process.env.EMAIL_TOKEN_ENCRYPTION_KEY || '').trim()
  if (!oauthStateSecret && !emailTokenKey) {
    errors.push(
      'EMAIL_OAUTH_STATE_SECRET or EMAIL_TOKEN_ENCRYPTION_KEY is required in production and staging '
      + '(email OAuth state signing; do not reuse JWT_SECRET).',
    )
  }

  if (isRedisRequired() && !String(process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL || '').trim()) {
    errors.push(
      'REDIS_URL is required when EXPECTED_REPLICAS > 1 or REQUIRE_REDIS=true '
      + '(multi-instance rate limits and Socket.IO fan-out).',
    )
  }

  return errors
}

function expectedReplicaCount() {
  const raw = Number(process.env.EXPECTED_REPLICAS || process.env.RAILWAY_REPLICA_COUNT || 1)
  if (!Number.isFinite(raw) || raw < 1) return 1
  return Math.floor(raw)
}

function isRedisRequired() {
  if (String(process.env.REQUIRE_REDIS || '').trim().toLowerCase() === 'true') return true
  return expectedReplicaCount() > 1
}

/** @deprecated use validateHardenedDeploySecrets */
function validateProductionSecrets() {
  return validateHardenedDeploySecrets()
}

module.exports = {
  isProductionEnv,
  isStagingEnv,
  isHardenedDeployEnv,
  isWeakJwtSecret,
  isWeakBridgeToken,
  validateHardenedDeploySecrets,
  validateProductionSecrets,
  expectedReplicaCount,
  isRedisRequired,
  MIN_PRODUCTION_JWT_LENGTH,
}
