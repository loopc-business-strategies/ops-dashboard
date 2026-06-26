/**
 * Read-only checks before any migration apply or destructive script.
 * Never connects to MongoDB or mutates data.
 */

function envBool(value) {
  return String(value || '').trim().toLowerCase() === 'true'
}

function redactMongoUri(uri) {
  const raw = String(uri || '').trim()
  if (!raw) return '(not set)'
  try {
    const parsed = new URL(raw.replace(/^mongodb(\+srv)?:\/\//, 'https://'))
    const host = parsed.hostname || 'unknown-host'
    const db = parsed.pathname.replace(/^\//, '') || '(default)'
    return `${host}/${db}`
  } catch {
    return '(invalid-uri)'
  }
}

function looksLikeLocalOrEphemeralUri(uri) {
  const lower = String(uri || '').toLowerCase()
  return (
    lower.includes('localhost')
    || lower.includes('127.0.0.1')
    || lower.includes('memory')
    || lower.includes('mongodb-memory-server')
  )
}

function looksLikeNonProductionUri(uri) {
  const lower = String(uri || '').toLowerCase()
  if (looksLikeLocalOrEphemeralUri(uri)) return true
  return /staging|preview|test|dev|sandbox|smoke|qa|uat/.test(lower)
}

function assertMigrationApplyAllowed({ tenants, resolveUri }) {
  if (!envBool(process.env.MIGRATION_I_HAVE_BACKUP)) {
    throw new Error(
      'Refusing migration apply without MIGRATION_I_HAVE_BACKUP=true. '
      + 'Take a MongoDB backup first (see docs/MONGODB-BACKUPS-AND-DATA-SAFETY.md).',
    )
  }

  const confirmToken = String(process.env.MIGRATION_CONFIRM_TOKEN || '').trim()
  if (!confirmToken) {
    throw new Error(
      'Refusing migration apply without MIGRATION_CONFIRM_TOKEN in the environment.',
    )
  }

  if (envBool(process.env.ALLOW_PRODUCTION_MIGRATION)) {
    return
  }

  for (const tenant of tenants) {
    const uri = resolveUri(tenant)
    if (!uri) continue
    if (!looksLikeNonProductionUri(uri)) {
      throw new Error(
        `[${tenant}] Refusing migration apply on production-like target ${redactMongoUri(uri)}. `
        + 'Use a staging database, or set ALLOW_PRODUCTION_MIGRATION=true only after a verified backup.',
      )
    }
  }
}

module.exports = {
  envBool,
  redactMongoUri,
  looksLikeLocalOrEphemeralUri,
  looksLikeNonProductionUri,
  assertMigrationApplyAllowed,
}
