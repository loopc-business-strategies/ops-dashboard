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

  return errors
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
  MIN_PRODUCTION_JWT_LENGTH,
}
