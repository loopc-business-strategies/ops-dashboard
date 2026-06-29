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

function isProductionEnv() {
  return String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production'
}

function isWeakJwtSecret(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return true
  if (WEAK_JWT_PLACEHOLDERS.has(trimmed)) return true
  if (isProductionEnv() && trimmed === 'test-secret') return true
  if (isProductionEnv() && trimmed.length < MIN_PRODUCTION_JWT_LENGTH) return true
  return false
}

function isWeakBridgeToken(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return false
  return WEAK_BRIDGE_PLACEHOLDERS.has(trimmed)
}

function validateProductionSecrets() {
  const errors = []

  if (!isProductionEnv()) return errors

  if (isWeakJwtSecret(process.env.JWT_SECRET)) {
    errors.push(
      'JWT_SECRET is missing, too short, or uses a placeholder value. '
      + `Set a random secret of at least ${MIN_PRODUCTION_JWT_LENGTH} characters.`,
    )
  }

  const bridgeToken = String(process.env.METAL_RATES_BRIDGE_TOKEN || '').trim()
  if (bridgeToken && isWeakBridgeToken(bridgeToken)) {
    errors.push('METAL_RATES_BRIDGE_TOKEN uses a placeholder value — generate a unique secret.')
  }

  return errors
}

module.exports = {
  isProductionEnv,
  isWeakJwtSecret,
  isWeakBridgeToken,
  validateProductionSecrets,
  MIN_PRODUCTION_JWT_LENGTH,
}
