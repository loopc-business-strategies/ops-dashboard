/**
 * Pure helpers for production/staging smoke login credential resolution.
 * Dedicated per-tenant secrets are preferred; shared SMOKE_AUTH_* is a fallback
 * for mg/cg/loopc only (never vb).
 */

function tenantEnvName(base, tenant) {
  return `${base}_${String(tenant || '').toUpperCase()}`
}

/**
 * @param {string} tenant
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {{ name: string, password: string, source: string }[]}
 */
function listTenantSmokeCredentialCandidates(tenant, env = process.env) {
  const key = String(tenant || '').toLowerCase()
  const candidates = []

  const dedicatedName = String(env[tenantEnvName('SMOKE_AUTH_NAME', tenant)] || '').trim()
  const dedicatedPass = String(env[tenantEnvName('SMOKE_AUTH_PASSWORD', tenant)] || '').trim()
  if (dedicatedName && dedicatedPass) {
    candidates.push({
      name: dedicatedName,
      password: dedicatedPass,
      source: `dedicated SMOKE_AUTH_*_${key.toUpperCase()}`,
    })
  }

  // Shared smoke users were provisioned in MG/CG/LoopC only. VB must use SMOKE_AUTH_*_VB.
  if (key !== 'vb') {
    const sharedName = String(env.SMOKE_AUTH_NAME || '').trim()
    const sharedPass = String(env.SMOKE_AUTH_PASSWORD || '').trim()
    if (sharedName && sharedPass) {
      const sameAsDedicated = dedicatedName === sharedName && dedicatedPass === sharedPass
      if (!sameAsDedicated) {
        candidates.push({
          name: sharedName,
          password: sharedPass,
          source: 'shared SMOKE_AUTH_*',
        })
      }
    }
  }

  return candidates
}

/**
 * First available credential pair (dedicated preferred), or null.
 * @param {string} tenant
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
function getTenantSmokeCredentials(tenant, env = process.env) {
  const [first] = listTenantSmokeCredentialCandidates(tenant, env)
  return first ? { name: first.name, password: first.password } : null
}

module.exports = {
  tenantEnvName,
  listTenantSmokeCredentialCandidates,
  getTenantSmokeCredentials,
}
