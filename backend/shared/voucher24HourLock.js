/**
 * Tenant rollout for 24-Hour Voucher / JV Lock.
 * Enabled for LOOPC and CG by default. MG is intentionally excluded.
 *
 * Override with env VOUCHER_24H_LOCK_TENANTS=loopc,cg
 * (comma-separated). Empty string disables all; unset uses defaults below.
 */

const DEFAULT_ENABLED_TENANTS = ['loopc', 'cg']

function parseEnabledTenants() {
  const raw = process.env.VOUCHER_24H_LOCK_TENANTS
  if (raw === undefined || raw === null) return DEFAULT_ENABLED_TENANTS
  return String(raw)
    .split(',')
    .map((t) => String(t || '').trim().toLowerCase())
    .filter(Boolean)
}

function isVoucher24HourLockFeatureEnabled(tenant) {
  const key = String(tenant || '').trim().toLowerCase()
  if (!key) return false
  return parseEnabledTenants().includes(key)
}

module.exports = {
  DEFAULT_ENABLED_TENANTS,
  isVoucher24HourLockFeatureEnabled,
}
