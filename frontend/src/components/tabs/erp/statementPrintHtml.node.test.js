import { describe, expect, test, vi } from 'vitest'
import { generateStatementHtml } from './statementPrintHtml'

const createLogoRenderAsset = vi.fn(async () => 'data:image/png;base64,rasterized')

vi.mock('./ERPBrandingUtils', () => ({
  DEFAULT_STATEMENT_PRINT: { companyNameFontSize: 15, addressFontSize: 10 },
  STATEMENT_COMPANY_NAME_FONT_MIN: 10,
  STATEMENT_COMPANY_NAME_FONT_MAX: 28,
  STATEMENT_ADDRESS_FONT_MIN: 8,
  STATEMENT_ADDRESS_FONT_MAX: 16,
  clampBrandingDimension: (_value, fallback) => fallback ?? 120,
  clampStatementFontSize: (value, fallback, min, max) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return fallback
    return Math.min(Math.max(parsed, min), max)
  },
  createLogoRenderAsset: (...args) => createLogoRenderAsset(...args),
}))

const baseCtx = {
  accountEnquiryData: {
    account: {
      accountCode: '1000',
      accountName: 'CASH ON HAND',
      address: 'Main office',
    },
    balances: { netBalance: 50.99 },
    metals: { goldBalance: 0, silverBalance: 0 },
  },
  filteredStatementEntries: [
    {
      _id: 'e1',
      date: '2026-05-10',
      description: 'payment voucher for office expenses',
      debitAmount: 0,
      creditAmount: 44.3,
      metalSignedWeight: 0,
      referenceType: 'payment',
    },
  ],
  resolveStatementReceiptNo: () => 'Pay/2025/0014',
  statementSelectedMetalCode: 'XAU',
  resolvePreferredStatementMetalCode: () => 'XAU',
  statementDisplayCurrency: 'USD',
  rawStatementEntries: [],
  formatStatementDate: (value) => String(value || ''),
  convertStatementDisplayAmount: (value) => Number(value || 0),
  tenantBranding: { key: 'mg', displayName: 'MG' },
  user: { name: 'Nan', company: 'mg' },
  branding: {
    companyName: 'MODERN GOLD JEWELRY MANUFACTURING',
    address: '242, Girvonbulok Street',
  },
  defaultBranding: { companyName: 'LoopC', logoWidth: 120, logoHeight: 90 },
  statementFilters: { startDate: '2026-05-10', endDate: '2026-05-13' },
}

describe('statementPrintHtml', () => {
  test('uses print-friendly header colors instead of yellow', async () => {
    const result = await generateStatementHtml(baseCtx)
    expect(result?.html).toContain('--soa-header-bg: #E8ECF1')
    expect(result?.html).not.toContain('--soa-yellow')
    expect(result?.html).not.toContain('#FFD56A')
  })

  test('labels Amount column with statement display currency (not forced USD)', async () => {
    const result = await generateStatementHtml({
      ...baseCtx,
      statementDisplayCurrency: 'UZS',
      branding: {
        companyName: 'National Bank Statement Co',
        address: 'Namangan',
        statementPrint: { title: 'Statement of Account' },
      },
    })
    expect(result?.html).toContain('Amount (UZS)')
    expect(result?.html).toContain('National Bank Statement Co')
    expect(result?.html).not.toContain('Amount (USD)')
  })

  test('aligns Balance C/F like Balance B/F in the narration column', async () => {
    const result = await generateStatementHtml(baseCtx)
    expect(result?.html).toContain('<td colspan="2"></td>\n                  <td class="carry-label">Balance B/F</td>')
    expect(result?.html).toContain('<td colspan="2"></td>\n                  <td class="carry-label">Balance C/F</td>')
    expect(result?.html).not.toMatch(/class="carry-label" colspan="3">Balance C\/F/)
  })

  test('right-aligns numeric sub-headers and body amounts', async () => {
    const result = await generateStatementHtml(baseCtx)
    expect(result?.html).toContain('class="num-head">Debit</th>')
    expect(result?.html).toContain('class="col-doc">Pay/2025/0014</td>')
    expect(result?.html).toContain('font-variant-numeric: tabular-nums')
  })

  test('uses company-left logo-right LOOPC header layout', async () => {
    const result = await generateStatementHtml({
      ...baseCtx,
      tenantBranding: { key: 'loopc', displayName: 'LoopC' },
      user: { name: 'Nan', company: 'loopc' },
      branding: {
        companyName: 'LoopC Trading',
        address: 'Dubai',
        statementPrint: {
          title: 'Account Statement',
          subtitle: 'Internal copy',
          signatories: [{ title: 'Prepared By', name: 'Ops', visible: true }],
        },
      },
    })
    expect(result?.html).toContain('header-loopc')
    expect(result?.html).toContain('LoopC Trading')
    expect(result?.html).toContain('Account Statement')
    expect(result?.html).toContain('Internal copy')
    expect(result?.html).toContain('Prepared By')
  })

  test('MG tenant uses master header-loopc layout', async () => {
    const result = await generateStatementHtml(baseCtx)
    expect(result?.html).toContain('header-loopc')
    expect(result?.html).toContain('brand-copy-loopc')
    expect(result?.html).toContain('MODERN GOLD JEWELRY MANUFACTURING')
    expect(result?.html).toContain('class="company" style="font-size:15px"')
    expect(result?.html).not.toContain('class="brand-copy brand-copy-loopc"')
  })

  test('custom statement typography sizes appear inline in print HTML', async () => {
    const result = await generateStatementHtml({
      ...baseCtx,
      branding: {
        ...baseCtx.branding,
        statementPrint: {
          companyNameFontSize: 13,
          addressFontSize: 9,
        },
      },
    })
    expect(result?.html).toContain('class="company" style="font-size:13px"')
    expect(result?.html).toContain('class="muted" style="font-size:9px"')
  })

  test('screen preview embeds original logoUrl without rasterization', async () => {
    createLogoRenderAsset.mockClear()
    const logoUrl = 'data:image/png;base64,sharp-logo'
    const result = await generateStatementHtml({
      ...baseCtx,
      screenPreview: true,
      branding: {
        ...baseCtx.branding,
        logoUrl,
        logoWidth: 180,
        logoHeight: 56,
      },
    })
    expect(createLogoRenderAsset).not.toHaveBeenCalled()
    expect(result?.html).toContain(logoUrl)
  })

  test('print export rasterizes logo for output', async () => {
    createLogoRenderAsset.mockClear()
    const result = await generateStatementHtml({
      ...baseCtx,
      branding: {
        ...baseCtx.branding,
        logoUrl: 'data:image/png;base64,sharp-logo',
        logoWidth: 180,
        logoHeight: 56,
      },
    })
    expect(createLogoRenderAsset).toHaveBeenCalledWith(
      'data:image/png;base64,sharp-logo',
      120,
      90,
      'contain',
      { renderScale: 2 },
    )
    expect(result?.html).toContain('data:image/png;base64,rasterized')
  })

  test('formats Dr/Cr balances with a space before the suffix', async () => {
    const result = await generateStatementHtml({
      ...baseCtx,
      accountEnquiryData: {
        ...baseCtx.accountEnquiryData,
        balances: { netBalance: 1250.75 },
      },
    })
    expect(result?.html).toContain('1,250.75 Dr')
    expect(result?.html).not.toMatch(/1,250\.75Dr/)
  })

  test('uses A4-landscape fit layout with wrap rules and wider Doc No column', async () => {
    const result = await generateStatementHtml(baseCtx)
    expect(result?.html).toContain('.sheet { width: 100%; max-width: 100%')
    expect(result?.html).not.toContain('min-width: 1050px')
    expect(result?.html).toContain('font-size: 11px; margin-top: 0; table-layout: fixed')
    expect(result?.html).toContain('border: 1px solid var(--soa-border); padding: 4px 5px')
    expect(result?.html).toContain('<col style="width:13%;" />')
    expect(result?.html).toContain('<col style="width:11%;" />')
    expect(result?.html).toContain('<col style="width:9.5%;" />')
    expect(result?.html).toContain('.col-doc { text-align: left; overflow-wrap: anywhere; word-break: break-word; }')
    expect(result?.html).toContain('.col-date { text-align: center; white-space: nowrap; }')
    expect(result?.html).toContain('.narration { text-align: left; overflow-wrap: anywhere')
    expect(result?.html).toContain('@page { size: A4 landscape; margin: 8mm; }')
    expect(result?.html).toContain('-webkit-font-smoothing: antialiased')
  })

  test('keeps long Doc No and Cyrillic narration in separate cells', async () => {
    const result = await generateStatementHtml({
      ...baseCtx,
      filteredStatementEntries: [
        {
          _id: 'e-long',
          date: '2026-03-24T12:00:00',
          description: 'Перевод средств на расчётный счёт поставщика по договору поставки металла',
          debitAmount: 0,
          creditAmount: 1200,
          metalSignedWeight: 0,
          referenceType: 'bank_jv',
        },
      ],
      resolveStatementReceiptNo: () => 'BnkJV/2026/0002',
    })
    expect(result?.html).toContain('class="col-doc">BnkJV/2026/0002</td>')
    expect(result?.html).toMatch(/class="col-date">24-Mar-26<\/td>/)
    expect(result?.html).toContain('class="narration">Перевод средств на расчётный счёт поставщика по договору поставки металла</td>')
    expect(result?.html).not.toContain('BnkJV/2026/000224-Mar-26')
  })
})
