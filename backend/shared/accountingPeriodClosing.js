/**
 * Tenant rollout for Accounting Period Closing / Book Locking.
 * Enabled for LOOPC, CG, and MG by default.
 *
 * Override with env ACCOUNTING_PERIOD_CLOSING_TENANTS=loopc,cg,mg
 * (comma-separated). Empty string disables all; unset uses defaults below.
 */

const DEFAULT_ENABLED_TENANTS = ['loopc', 'cg', 'mg']

function parseEnabledTenants() {
  const raw = process.env.ACCOUNTING_PERIOD_CLOSING_TENANTS
  if (raw === undefined || raw === null) return DEFAULT_ENABLED_TENANTS
  return String(raw)
    .split(',')
    .map((t) => String(t || '').trim().toLowerCase())
    .filter(Boolean)
}

function isAccountingPeriodClosingEnabled(tenant) {
  const key = String(tenant || '').trim().toLowerCase()
  if (!key) return false
  return parseEnabledTenants().includes(key)
}

module.exports = {
  DEFAULT_ENABLED_TENANTS,
  isAccountingPeriodClosingEnabled,
}
