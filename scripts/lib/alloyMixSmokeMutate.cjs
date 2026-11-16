'use strict'

const PROD_API_BASE_RE = /^https:\/\/api\.loopcstrategies\.com\/?$/i

function isProductionAlloyMixApiBase(apiBase) {
  return PROD_API_BASE_RE.test(String(apiBase || '').trim())
}

/**
 * Mutate probe is allowed only with explicit flag + non-prod staging-ish target.
 */
function isStagingAlloyMixMutateContext({
  apiBase = '',
  envLabel = '',
  mutate = false,
} = {}) {
  if (!mutate) return false
  if (isProductionAlloyMixApiBase(apiBase)) return false
  const label = String(envLabel || '').trim()
  const base = String(apiBase || '').trim()
  return /staging/i.test(label)
    || /staging/i.test(base)
    || /\.up\.railway\.app$/i.test(base.replace(/\/$/, ''))
}

function pickVaultMixForRoundTrip(jobs = []) {
  return (Array.isArray(jobs) ? jobs : []).find((row) => (
    row
    && row.id
    && String(row.currentDepartment || '').toLowerCase() === 'vault_room'
    && row.hasOpenFloorDescendants !== true
    && Number(row.targetGross) > 0
  )) || null
}

module.exports = {
  PROD_API_BASE_RE,
  isProductionAlloyMixApiBase,
  isStagingAlloyMixMutateContext,
  pickVaultMixForRoundTrip,
}
