const {
  legacySupplierDeprecation,
  LEGACY_SUPPLIER_DEPRECATION,
} = require('../utils/legacyErpDeprecation')

describe('legacy ERP supplier deprecation', () => {
  test('includes successor API and message', () => {
    const payload = legacySupplierDeprecation('create')
    expect(payload.useInstead).toBe('/api/erp-accounting/vendors')
    expect(payload.action).toBe('create')
    expect(payload.message).toMatch(/accounting vendors/i)
    expect(LEGACY_SUPPLIER_DEPRECATION.api).toBe('/api/erp/procurement/suppliers')
  })
})
