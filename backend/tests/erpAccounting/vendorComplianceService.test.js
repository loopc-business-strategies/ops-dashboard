const {
  createVendorComplianceService,
  REQUIRED_VENDOR_DOCUMENTS_BY_CATEGORY,
} = require('../../services/erpAccounting/vendorComplianceService')

describe('vendorComplianceService', () => {
  const { evaluateVendorCompliance } = createVendorComplianceService({
    Transaction: {},
    Ledger: {},
    toMoney: (n) => n,
    getOutstandingForAccount: async () => 0,
    getAgingForAccount: async () => ({
      bucket0to30: 0, bucket31to60: 0, bucket61to90: 0, bucket90Plus: 0, total: 0,
    }),
  })
  test('evaluateVendorCompliance flags missing required documents', () => {
    const vendor = { category: 'general', documents: [] }
    const r = evaluateVendorCompliance(vendor, new Date('2026-01-01'))
    expect(r.compliant).toBe(false)
    expect(r.missingDocuments.length).toBeGreaterThan(0)
    expect(REQUIRED_VENDOR_DOCUMENTS_BY_CATEGORY.general).toContain('contract')
  })
})
