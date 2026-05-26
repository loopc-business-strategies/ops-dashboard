const { normalizeBrandingKey, DEFAULT_REPORT_BRANDING } = require('../../services/erpAccounting/reportBrandingService')

describe('reportBrandingService', () => {
  test('normalizeBrandingKey slugifies values', () => {
    expect(normalizeBrandingKey('  Main Branch #1 ')).toBe('main-branch-1')
  })

  test('DEFAULT_REPORT_BRANDING has default key', () => {
    expect(DEFAULT_REPORT_BRANDING.key).toBe('default')
  })
})
