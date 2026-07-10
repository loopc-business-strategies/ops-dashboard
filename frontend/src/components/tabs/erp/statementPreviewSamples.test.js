import { describe, expect, test, vi } from 'vitest'
import {
  buildStatementPreviewContext,
  buildStatementPreviewHtml,
} from './statementPreviewSamples'

const createLogoRenderAsset = vi.fn(async () => 'data:image/png;base64,rasterized')

vi.mock('./ERPBrandingUtils', () => ({
  DEFAULT_BRANDING: { companyName: 'LoopC', logoWidth: 120, logoHeight: 90 },
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

describe('statementPreviewSamples', () => {
  test('preview context enables screen preview mode', () => {
    const ctx = buildStatementPreviewContext({
      mode: 'empty',
      branding: { companyName: 'LoopC' },
      user: { company: 'loopc', name: 'Tester' },
    })
    expect(ctx.screenPreview).toBe(true)
  })

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
    expect(result.html).toContain('class="company" style="font-size:15px"')
    expect(result.html).toContain('class="muted" style="font-size:10px"')
    expect(result.html).not.toContain('class="brand-copy brand-copy-loopc"')
  })

  test('custom statement typography sizes appear inline in preview HTML', async () => {
    const result = await buildStatementPreviewHtml({
      mode: 'sample',
      branding: {
        companyName: 'MODERN GOLD JEWELRY MANUFACTURING FE LLC',
        address: 'Dubai, UAE',
        statementPrint: {
          companyNameFontSize: 13,
          addressFontSize: 9,
        },
      },
      user: { company: 'mg', name: 'Tester' },
    })
    expect(result.html).toContain('class="company" style="font-size:13px"')
    expect(result.html).toContain('class="muted" style="font-size:9px"')
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

  test('buildStatementPreviewHtml uses original logoUrl and skips logo rasterization', async () => {
    createLogoRenderAsset.mockClear()
    const logoUrl = 'data:image/png;base64,preview-logo'
    const result = await buildStatementPreviewHtml({
      mode: 'empty',
      branding: {
        companyName: 'LoopC',
        logoUrl,
        logoWidth: 180,
        logoHeight: 56,
        logoFit: 'contain',
      },
      user: { company: 'loopc', name: 'Tester' },
    })
    expect(createLogoRenderAsset).not.toHaveBeenCalled()
    expect(result.html).toContain(logoUrl)
    expect(result.html).not.toContain('data:image/png;base64,rasterized')
  })

  test('preview HTML uses clarified table layout and Dr/Cr spacing', async () => {
    const result = await buildStatementPreviewHtml({
      mode: 'sample',
      branding: { companyName: 'LoopC' },
      user: { company: 'loopc', name: 'Tester' },
    })
    expect(result.html).toContain('min-width: 1050px')
    expect(result.html).toContain('font-size: 14px; margin-top: 0; table-layout: fixed')
    expect(result.html).toContain('<col style="width:11%;" />')
    expect(result.html).toMatch(/\d[\d,]*\.\d{2} Dr/)
  })
})
