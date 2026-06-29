const {
  legacySupplierDeprecation,
  LEGACY_SUPPLIER_DEPRECATION,
  LEGACY_FINANCE_RECORDS_DEPRECATION,
  rejectLegacySupplierWrite,
  rejectLegacyFinanceRecords,
} = require('../utils/legacyErpDeprecation')

describe('legacy ERP supplier deprecation', () => {
  test('includes successor API and message', () => {
    const payload = legacySupplierDeprecation('create')
    expect(payload.useInstead).toBe('/api/erp-accounting/vendors')
    expect(payload.action).toBe('create')
    expect(payload.message).toMatch(/accounting vendors/i)
    expect(LEGACY_SUPPLIER_DEPRECATION.api).toBe('/api/erp/procurement/suppliers')
  })

  test('rejectLegacySupplierWrite returns 410 with deprecation metadata', () => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value
      },
      status(code) {
        this.statusCode = code
        return this
      },
      json(body) {
        this.body = body
        return this
      },
    }

    rejectLegacySupplierWrite(res)
    expect(res.statusCode).toBe(410)
    expect(res.headers.Deprecation).toBe('true')
    expect(res.body.success).toBe(false)
    expect(res.body.deprecation.useInstead).toBe('/api/erp-accounting/vendors')
  })

  test('rejectLegacyFinanceRecords returns 410 with successor API', () => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value
      },
      status(code) {
        this.statusCode = code
        return this
      },
      json(body) {
        this.body = body
        return this
      },
    }

    rejectLegacyFinanceRecords(res, 'read')
    expect(res.statusCode).toBe(410)
    expect(res.headers['X-Legacy-Erp-Api']).toBe('true')
    expect(res.body.deprecation.useInstead).toBe('/api/erp-accounting')
    expect(LEGACY_FINANCE_RECORDS_DEPRECATION.api).toBe('/api/erp/finance/records')
  })
})
