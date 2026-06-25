const LEGACY_SUPPLIER_DEPRECATION = Object.freeze({
  api: '/api/erp/procurement/suppliers',
  useInstead: '/api/erp-accounting/vendors',
  message:
    'Legacy ops suppliers are for procurement only. Create accounting vendors on /api/erp-accounting for ledger-linked parties.',
  doc: 'docs/ERP-DUAL-API-DEPRECATION.md',
})

function legacySupplierDeprecation(action = 'write') {
  console.warn(`[legacy-erp] supplier ${action} — use /api/erp-accounting/vendors for accounting parties`)
  return { ...LEGACY_SUPPLIER_DEPRECATION, action }
}

function withLegacySupplierDeprecation(res, payload, action, status = 200) {
  res.setHeader('Deprecation', 'true')
  res.setHeader('Link', '</api/erp-accounting/vendors>; rel="successor-version"')
  return res.status(status).json({
    ...payload,
    deprecation: legacySupplierDeprecation(action),
  })
}

module.exports = {
  LEGACY_SUPPLIER_DEPRECATION,
  legacySupplierDeprecation,
  withLegacySupplierDeprecation,
}
