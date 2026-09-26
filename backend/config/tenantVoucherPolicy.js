/** Per-tenant voucher denylist (defense-in-depth). */
const DISABLED_VOUCHER_TYPES_BY_TENANT = {
  mg: ['metal_transfer'],
  cg: ['metal_transfer'],
  vb: ['metal_transfer'],
}

/** Types enabled only on LoopC (allowlist). Takes precedence over denylist. */
const LOOPC_ONLY_VOUCHER_TYPES = ['metal_transfer']

function normalizeTenantKey(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeVoucherType(type) {
  return String(type || '').trim().toLowerCase()
}

function isLoopcOnlyVoucherType(type) {
  return LOOPC_ONLY_VOUCHER_TYPES.includes(normalizeVoucherType(type))
}

function getDisabledVoucherTypes(tenant) {
  const key = normalizeTenantKey(tenant)
  const fromMap = Array.isArray(DISABLED_VOUCHER_TYPES_BY_TENANT[key])
    ? DISABLED_VOUCHER_TYPES_BY_TENANT[key].map(normalizeVoucherType).filter(Boolean)
    : []
  // Unknown / non-loopc tenants also treat LoopC-only types as disabled.
  if (key !== 'loopc') {
    const merged = new Set([...fromMap, ...LOOPC_ONLY_VOUCHER_TYPES])
    return [...merged]
  }
  return fromMap.filter((type) => !isLoopcOnlyVoucherType(type))
}

function isVoucherTypeEnabledForTenant(tenant, type) {
  const normalized = normalizeVoucherType(type)
  if (isLoopcOnlyVoucherType(normalized)) {
    return normalizeTenantKey(tenant) === 'loopc'
  }
  const disabled = new Set(getDisabledVoucherTypes(tenant))
  return !disabled.has(normalized)
}

function filterTransactionTypesForTenant(tenant, types = []) {
  return (Array.isArray(types) ? types : []).filter((type) => isVoucherTypeEnabledForTenant(tenant, type))
}

function getDisabledVoucherTypeMessage(tenant, type) {
  if (isVoucherTypeEnabledForTenant(tenant, type)) return ''
  const label = normalizeVoucherType(type)
  return `${label} vouchers are disabled for this tenant`
}

module.exports = {
  DISABLED_VOUCHER_TYPES_BY_TENANT,
  LOOPC_ONLY_VOUCHER_TYPES,
  getDisabledVoucherTypes,
  isLoopcOnlyVoucherType,
  isVoucherTypeEnabledForTenant,
  filterTransactionTypesForTenant,
  getDisabledVoucherTypeMessage,
}
