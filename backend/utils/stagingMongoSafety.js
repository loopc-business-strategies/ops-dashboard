const { looksLikeNonProductionUri, redactMongoUri } = require('./migrationSafety')

/**
 * Resolve dedicated staging URI only — never fall back to MONGO_URI_*.
 */
function resolveStagingMongoUri(tenant, env = process.env) {
  const key = String(tenant || '').trim().toUpperCase()
  return String(env[`STAGING_MONGO_URI_${key}`] || '').trim()
}

function assertStagingMongoTargets(tenants, env = process.env) {
  const missing = []
  const productionLike = []

  for (const tenant of tenants) {
    const uri = resolveStagingMongoUri(tenant, env)
    if (!uri) {
      missing.push(`STAGING_MONGO_URI_${String(tenant).toUpperCase()}`)
      continue
    }
    if (!looksLikeNonProductionUri(uri)) {
      productionLike.push({ tenant, host: redactMongoUri(uri) })
    }
  }

  if (missing.length) {
    throw new Error(
      `Missing staging Mongo URIs: ${missing.join(', ')}. `
      + 'Set dedicated STAGING_MONGO_URI_* (never use production MONGO_URI_* as a substitute).',
    )
  }

  if (productionLike.length) {
    const detail = productionLike.map((entry) => `${entry.tenant}→${entry.host}`).join(', ')
    throw new Error(
      `Refusing production-like staging targets: ${detail}. `
      + 'Use separate staging Atlas databases/clusters.',
    )
  }
}

/**
 * After staging URIs are validated, copy them into MONGO_URI_* for runners/connect.
 */
function mapStagingMongoToProcessEnv(env = process.env) {
  const out = { ...env }
  for (const tenant of ['mg', 'cg', 'loopc']) {
    const stagingKey = `STAGING_MONGO_URI_${tenant.toUpperCase()}`
    const uri = String(env[stagingKey] || '').trim()
    if (uri) {
      out[`MONGO_URI_${tenant.toUpperCase()}`] = uri
    }
  }
  return out
}

module.exports = {
  resolveStagingMongoUri,
  assertStagingMongoTargets,
  mapStagingMongoToProcessEnv,
}
