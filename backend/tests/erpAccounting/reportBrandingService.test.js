const {
  normalizeBrandingKey,
  DEFAULT_REPORT_BRANDING,
  DEFAULT_VOUCHER_PRINT,
  normalizeVoucherPrint,
  normalizeStatementPrint,
} = require('../../services/erpAccounting/reportBrandingService')

describe('reportBrandingService', () => {
  test('normalizeBrandingKey slugifies values', () => {
    expect(normalizeBrandingKey('  Main Branch #1 ')).toBe('main-branch-1')
  })

  test('DEFAULT_REPORT_BRANDING has default key', () => {
    expect(DEFAULT_REPORT_BRANDING.key).toBe('default')
  })

  test('DEFAULT_REPORT_BRANDING includes voucher and statement print defaults', () => {
    expect(DEFAULT_REPORT_BRANDING.voucherPrint.tableHeaders.no).toBe('No.')
    expect(DEFAULT_REPORT_BRANDING.statementPrint.title).toBe('Statement of Account')
  })

  test('normalizeVoucherPrint clamps offsets and preserves signatories', () => {
    const result = normalizeVoucherPrint({
      logoOffsetX: 500,
      logoOffsetY: -200,
      tableHeaders: { no: 'S.No' },
      signatories: [{ title: 'Receiver', name: 'Ali', visible: true }],
    })
    expect(result.logoOffsetX).toBe(120)
    expect(result.logoOffsetY).toBe(-120)
    expect(result.tableHeaders.no).toBe('S.No')
    expect(result.signatories[0].title).toBe('Receiver')
    expect(result.signatories[0].name).toBe('Ali')
    expect(result.signatories[1].title).toBe(DEFAULT_VOUCHER_PRINT.signatories[1].title)
  })

  test('normalizeStatementPrint applies title and showPrintNote defaults', () => {
    const result = normalizeStatementPrint({
      title: 'Account Statement',
      showPrintNote: false,
    })
    expect(result.title).toBe('Account Statement')
    expect(result.showPrintNote).toBe(false)
    expect(result.logoTransparent).toBe(true)
  })
})
