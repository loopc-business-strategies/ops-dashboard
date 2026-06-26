/**
 * Environment helpers for security-sensitive code paths.
 * Only `development` and `test` skip production-grade guards (rate limits, tokens, etc.).
 * Staging and other NODE_ENV values are treated as hardened.
 */

function isLocalDevEnv() {
  const env = String(process.env.NODE_ENV || '').trim().toLowerCase()
  return env === 'development' || env === 'test'
}

function isProductionEnv() {
  return String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production'
}

module.exports = {
  isLocalDevEnv,
  isProductionEnv,
}
