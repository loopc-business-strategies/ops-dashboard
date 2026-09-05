/**
 * Fail-closed staging-only gate for DB scripts and migrations.
 * Never connects to MongoDB. Throws on any non-staging target.
 */

const { looksLikeNonProductionUri, redactMongoUri } = require('./migrationSafety')
const {
  resolveStagingMongoUri,
  assertStagingMongoTargets,
  mapStagingMongoToProcessEnv,
} = require('./stagingMongoSafety')

const IGNORED_PRODUCTION_OVERRIDE_FLAGS = [
  'ALLOW_PRODUCTION_DESTRUCTIVE_SCRIPT',
  'ALLOW_PRODUCTION_MIGRATION',
  'ALLOW_PRODUCTION_CLEANUP',
]

function envBool(value) {
  return String(value || '').trim().toLowerCase() === 'true'
}

function isApprovedStagingAppEnv(env = process.env) {
  return String(env.APP_ENV || '').trim().toLowerCase() === 'staging'
}

function warnIgnoredProductionOverrides(env = process.env) {
  for (const key of IGNORED_PRODUCTION_OVERRIDE_FLAGS) {
    if (envBool(env[key])) {
      console.warn(
        `[assertStagingOnlyScript] ${key}=true is IGNORED/deprecated and does not bypass staging-only guards.`,
      )
    }
  }
}

function hasProductionCliFlag(argv = process.argv) {
  return Array.isArray(argv) && argv.includes('--production')
}

function hostnameFromMongoUri(uri) {
  const raw = String(uri || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw.replace(/^mongodb(\+srv)?:\/\//, 'https://'))
    return String(parsed.hostname || '').trim().toLowerCase()
  } catch {
    return ''
  }
}

function parseHostAllowlist(env = process.env) {
  return String(env.STAGING_MONGO_HOST_ALLOWLIST || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

function assertHostAllowlist(uri, env = process.env) {
  const allowlist = parseHostAllowlist(env)
  if (!allowlist.length) return

  const host = hostnameFromMongoUri(uri)
  if (!host || !allowlist.includes(host)) {
    throw new Error(
      `Refusing Mongo host "${host || '(unknown)'}" — not in STAGING_MONGO_HOST_ALLOWLIST `
      + `(${allowlist.join(', ')}).`,
    )
  }
}

/**
 * Fail-closed staging-only assert. Never connects Mongo.
 * Requires APP_ENV=staging and dedicated STAGING_MONGO_URI_* per tenant.
 * @param {{ scriptName?: string, tenants: string[] }} options
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string[]} [argv]
 */
function assertStagingOnlyScript({ scriptName, tenants } = {}, env = process.env, argv = process.argv) {
  const name = String(scriptName || 'script').trim() || 'script'
  const tenantList = (Array.isArray(tenants) ? tenants : [])
    .map((tenant) => String(tenant || '').trim().toLowerCase())
    .filter(Boolean)

  warnIgnoredProductionOverrides(env)

  if (hasProductionCliFlag(argv)) {
    throw new Error(
      `[${name}] Refusing --production flag. Staging-only DB scripts cannot target production.`,
    )
  }

  if (!isApprovedStagingAppEnv(env)) {
    throw new Error(
      `[${name}] Refusing: APP_ENV must be exactly "staging" `
      + `(got ${JSON.stringify(String(env.APP_ENV || '').trim() || '(missing)')}). `
      + 'Production execution is impossible.',
    )
  }

  if (!tenantList.length) {
    throw new Error(`[${name}] tenants array is required for staging assert.`)
  }

  // Dedicated STAGING_MONGO_URI_* only — no MONGO_URI_* fallback.
  assertStagingMongoTargets(tenantList, env)

  for (const tenant of tenantList) {
    const key = String(tenant).toUpperCase()
    const stagingUri = resolveStagingMongoUri(tenant, env)
    const mongoUri = String(env[`MONGO_URI_${key}`] || '').trim()

    console.log(`[${name}] staging target ${tenant}: ${redactMongoUri(stagingUri)}`)

    if (!looksLikeNonProductionUri(stagingUri)) {
      throw new Error(
        `[${name}] Refusing production-like STAGING_MONGO_URI_${key} target ${redactMongoUri(stagingUri)}. `
        + 'Production execution is impossible.',
      )
    }

    // If MONGO_URI_* is also set (e.g. before mapping), refuse production-like values.
    if (mongoUri && !looksLikeNonProductionUri(mongoUri)) {
      throw new Error(
        `[${name}] Refusing production-like MONGO_URI_${key} target ${redactMongoUri(mongoUri)}. `
        + 'Production execution is impossible.',
      )
    }

    assertHostAllowlist(stagingUri, env)
  }

  // After validation, copy STAGING_MONGO_URI_* → MONGO_URI_* for connect helpers.
  if (env === process.env) {
    const mapped = mapStagingMongoToProcessEnv(env)
    for (const tenant of tenantList) {
      const key = `MONGO_URI_${String(tenant).toUpperCase()}`
      if (mapped[key]) process.env[key] = mapped[key]
    }
  }
}

module.exports = {
  assertStagingOnlyScript,
  isApprovedStagingAppEnv,
  warnIgnoredProductionOverrides,
  IGNORED_PRODUCTION_OVERRIDE_FLAGS,
}
