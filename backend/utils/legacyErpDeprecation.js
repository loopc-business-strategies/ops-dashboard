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

function rejectLegacySupplierWrite(res) {
  res.setHeader('Deprecation', 'true')
  res.setHeader('Link', '</api/erp-accounting/vendors>; rel="successor-version"')
  return res.status(410).json({
    success: false,
    message: LEGACY_SUPPLIER_DEPRECATION.message,
    deprecation: legacySupplierDeprecation('write'),
  })
}

const LEGACY_FINANCE_RECORDS_DEPRECATION = Object.freeze({
  api: '/api/erp/finance/records',
  useInstead: '/api/erp-accounting',
  message:
    'Legacy ops finance records are removed. Use /api/erp-accounting for ledger-linked financial data.',
  doc: 'docs/ERP-DUAL-API-DEPRECATION.md',
})

function legacyFinanceRecordsDeprecation(action = 'read') {
  console.warn(`[legacy-erp] finance/records ${action} — use /api/erp-accounting`)
  return { ...LEGACY_FINANCE_RECORDS_DEPRECATION, action }
}

function rejectLegacyFinanceRecords(res, action = 'read') {
  res.setHeader('Deprecation', 'true')
  res.setHeader('X-Legacy-Erp-Api', 'true')
  res.setHeader('Link', '</api/erp-accounting>; rel="successor-version"')
  return res.status(410).json({
    success: false,
    message: LEGACY_FINANCE_RECORDS_DEPRECATION.message,
    deprecation: legacyFinanceRecordsDeprecation(action),
  })
}

function markLegacyErpApi(res) {
  res.setHeader('X-Legacy-Erp-Api', 'true')
}

module.exports = {
  LEGACY_SUPPLIER_DEPRECATION,
  LEGACY_FINANCE_RECORDS_DEPRECATION,
  legacySupplierDeprecation,
  legacyFinanceRecordsDeprecation,
  withLegacySupplierDeprecation,
  rejectLegacySupplierWrite,
  rejectLegacyFinanceRecords,
  markLegacyErpApi,
}
