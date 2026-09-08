/**
 * Safe Mongo URI fingerprints (host + database only). Never log passwords.
 */

function fingerprintMongoUri(uri) {
  const raw = String(uri || '').trim()
  if (!raw) return null
  try {
    const parsed = new URL(raw.replace(/^mongodb(\+srv)?:\/\//, 'https://'))
    const host = String(parsed.hostname || '').trim().toLowerCase()
    const db = String(parsed.pathname || '').replace(/^\//, '').split('?')[0].trim().toLowerCase()
    if (!host) return null
    return `${host}/${db || '(default)'}`
  } catch {
    return null
  }
}

function redactMongoUri(uri) {
  return fingerprintMongoUri(uri) || (String(uri || '').trim() ? '(invalid-uri)' : '(not set)')
}

/**
 * @param {Array<{ tenant: string, uri: string }>} entries
 * @returns {string[]} collision error messages
 */
function findTenantUriCollisions(entries) {
  const errors = []
  const seen = new Map()
  for (const row of entries) {
    const uri = String(row?.uri || '').trim()
    if (!uri) continue
    const fp = fingerprintMongoUri(uri)
    if (!fp) continue
    const prior = seen.get(fp)
    if (prior) {
      errors.push(
        `Tenants ${prior} and ${row.tenant} share the same Mongo host/database (${fp}). `
        + 'Each tenant must use a distinct database.',
      )
    } else {
      seen.set(fp, row.tenant)
    }
  }
  return errors
}

module.exports = {
  fingerprintMongoUri,
  redactMongoUri,
  findTenantUriCollisions,
}
