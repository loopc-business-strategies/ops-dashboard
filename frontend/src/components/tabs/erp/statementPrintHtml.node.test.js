import { describe, expect, test, vi } from 'vitest'
import { generateStatementHtml } from './statementPrintHtml'

vi.mock('./ERPBrandingUtils', () => ({
  clampBrandingDimension: (_value, fallback) => fallback ?? 120,
  createLogoRenderAsset: async () => null,
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
})
