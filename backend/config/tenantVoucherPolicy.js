/** Product Metal Transfer is LoopC-only; hide/reject on other tenants. */
const DISABLED_VOUCHER_TYPES_BY_TENANT = {
  mg: ['metal_transfer'],
  cg: ['metal_transfer'],
  vb: ['metal_transfer'],
}

function normalizeTenantKey(value) {
  return String(value || '').trim().toLowerCase()
}

function getDisabledVoucherTypes(tenant) {
  const key = normalizeTenantKey(tenant)
  return Array.isArray(DISABLED_VOUCHER_TYPES_BY_TENANT[key])
    ? DISABLED_VOUCHER_TYPES_BY_TENANT[key].map((type) => String(type || '').trim().toLowerCase()).filter(Boolean)
    : []
}

function isVoucherTypeEnabledForTenant(tenant, type) {
  const disabled = new Set(getDisabledVoucherTypes(tenant))
  return !disabled.has(String(type || '').trim().toLowerCase())
}

function filterTransactionTypesForTenant(tenant, types = []) {
  const disabled = new Set(getDisabledVoucherTypes(tenant))
  if (!disabled.size) return types
  return types.filter((type) => !disabled.has(String(type || '').trim().toLowerCase()))
}

function getDisabledVoucherTypeMessage(tenant, type) {
  if (isVoucherTypeEnabledForTenant(tenant, type)) return ''
  const label = String(type || '').trim().toLowerCase()
  return `${label} vouchers are disabled for this tenant`
}

module.exports = {
  DISABLED_VOUCHER_TYPES_BY_TENANT,
  getDisabledVoucherTypes,
  isVoucherTypeEnabledForTenant,
  filterTransactionTypesForTenant,
  getDisabledVoucherTypeMessage,
}
