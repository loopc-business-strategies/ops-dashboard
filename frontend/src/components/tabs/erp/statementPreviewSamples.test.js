import { describe, expect, test, vi } from 'vitest'
import {
  buildStatementPreviewContext,
  buildStatementPreviewHtml,
} from './statementPreviewSamples'

vi.mock('./ERPBrandingUtils', () => ({
  DEFAULT_BRANDING: { companyName: 'LoopC', logoWidth: 120, logoHeight: 90 },
  clampBrandingDimension: (_value, fallback) => fallback ?? 120,
  createLogoRenderAsset: async () => null,
}))

describe('statementPreviewSamples', () => {
  test('empty preview returns zero entries and blank account name', () => {
    const ctx = buildStatementPreviewContext({
      mode: 'empty',
      branding: { companyName: 'LoopC' },
      user: { company: 'loopc', name: 'Tester' },
    })
    expect(ctx.filteredStatementEntries).toEqual([])
    expect(ctx.accountEnquiryData.account.accountCode).toBe('CUST-001')
    expect(ctx.accountEnquiryData.account.accountName).toBe('')
    expect(ctx.balances?.netBalance).toBeUndefined()
    expect(ctx.accountEnquiryData.balances.netBalance).toBe(0)
  })

  test('sample preview returns multiple entries and non-zero balances', () => {
    const ctx = buildStatementPreviewContext({
      mode: 'sample',
      branding: { companyName: 'LoopC' },
      user: { company: 'loopc', name: 'Tester' },
    })
    expect(ctx.filteredStatementEntries.length).toBe(4)
    expect(ctx.accountEnquiryData.account.accountName).toBe('SAMPLE CUSTOMER LLC')
    expect(ctx.accountEnquiryData.balances.netBalance).toBe(1250.75)
    expect(ctx.accountEnquiryData.metals.goldBalance).toBe(15.5)
  })

  test('buildStatementPreviewHtml includes LOOPC header and custom title', async () => {
    const result = await buildStatementPreviewHtml({
      mode: 'sample',
      branding: {
        companyName: 'LoopC Trading',
        statementPrint: {
          title: 'Account Statement',
          subtitle: 'Internal copy',
          signatories: [{ title: 'Prepared By', name: 'Ops', visible: true }],
        },
      },
      user: { company: 'loopc', name: 'Tester' },
    })
    expect(result.html).toContain('header-loopc')
    expect(result.html).toContain('LoopC Trading')
    expect(result.html).toContain('Account Statement')
    expect(result.html).toContain('Internal copy')
    expect(result.title).toContain('Account Statement')
    expect(result.accountCode).toBe('CUST-001')
  })

  test('MG sample preview uses master header-loopc layout', async () => {
    const result = await buildStatementPreviewHtml({
      mode: 'sample',
      branding: {
        companyName: 'MODERN GOLD JEWELRY MANUFACTURING FE LLC',
        address: 'Dubai, UAE',
        statementPrint: { title: 'Statement of Account' },
      },
      user: { company: 'mg', name: 'Tester' },
    })
    expect(result.html).toContain('header-loopc')
    expect(result.html).toContain('brand-copy-loopc')
    expect(result.html).toContain('MODERN GOLD JEWELRY MANUFACTURING FE LLC')
    expect(result.html).toContain('.brand-copy-loopc .company { font-size: 15px')
    expect(result.html).toContain('class="brand-copy brand-copy-loopc"')
  })

  test('empty preview HTML still renders carry-forward rows', async () => {
    const result = await buildStatementPreviewHtml({
      mode: 'empty',
      branding: { companyName: 'LoopC' },
      user: { company: 'loopc', name: 'Tester' },
    })
    expect(result.html).toContain('Balance B/F')
    expect(result.html).toContain('Balance C/F')
  })
})
