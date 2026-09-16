/**
 * Tenant-scoped feature capabilities.
 * Keep in sync with frontend/src/config/tenantBranding.js mirrors.
 */

function normalizeTenantKey(tenantKey) {
  return String(tenantKey || '').trim().toLowerCase()
}

/** LoopC-only structured Employee → PayrollRun → Payslip. */
function isStructuredPayrollEnabled(tenantKey) {
  return normalizeTenantKey(tenantKey) === 'loopc'
}

module.exports = {
  normalizeTenantKey,
  isStructuredPayrollEnabled,
}
