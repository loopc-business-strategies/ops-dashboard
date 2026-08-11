import { beforeEach, describe, expect, test, vi } from 'vitest'

const {
  createLogoRenderAsset,
  save,
  autoTable,
  jsPDF,
  docApi,
  ensurePdfUnicodeFonts,
} = vi.hoisted(() => {
  const saveFn = vi.fn()
  const doc = {
    internal: { pageSize: { getWidth: () => 841.89, getHeight: () => 595.28 } },
    setFillColor: vi.fn(),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    rect: vi.fn(),
    line: vi.fn(),
    addImage: vi.fn(),
    addFileToVFS: vi.fn(),
    addFont: vi.fn(),
    splitTextToSize: vi.fn((text) => [String(text)]),
    getNumberOfPages: vi.fn(() => 1),
    setPage: vi.fn(),
    save: saveFn,
    lastAutoTable: null,
  }
  return {
    createLogoRenderAsset: vi.fn(async () => 'data:image/png;base64,logo'),
    save: saveFn,
    autoTable: vi.fn((d) => {
      d.lastAutoTable = { finalY: 200 }
    }),
    jsPDF: vi.fn(function JsPDF() {
      return doc
    }),
    docApi: doc,
    ensurePdfUnicodeFonts: vi.fn(async () => 'NotoSans'),
  }
})

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

vi.mock('./lazyExportLibs', () => ({
  loadPdfTools: vi.fn(async () => ({
    jsPDF,
    autoTable,
  })),
}))

vi.mock('./pdfUnicodeFont', () => ({
  PDF_UNICODE_FONT_FAMILY: 'NotoSans',
  PDF_FALLBACK_FONT_FAMILY: 'helvetica',
  ensurePdfUnicodeFonts: (...args) => ensurePdfUnicodeFonts(...args),
  resetPdfUnicodeFontCache: vi.fn(),
}))

import { exportStatementPdf } from './statementPdfExport'

const baseCtx = {
  accountEnquiryData: {
    account: {
      accountCode: '101001',
      accountName: 'NATIONAL BANK OF UZBEKISTAN-USD',
    },
    balances: { netBalance: 100 },
    metals: { goldBalance: 0 },
  },
  filteredStatementEntries: [
    {
      _id: 'e1',
      date: '2026-03-24T12:00:00',
      description: 'Свободная покупка у юр лиц',
      debitAmount: 0,
      creditAmount: 20000,
      metalSignedWeight: 0,
      referenceType: 'receipt',
    },
  ],
  resolveStatementReceiptNo: () => 'Rec/2026/0001',
  statementSelectedMetalCode: 'XAU',
  resolvePreferredStatementMetalCode: () => 'XAU',
  statementDisplayCurrency: 'USD',
  rawStatementEntries: [],
  formatStatementDate: (value) => String(value || ''),
  convertStatementDisplayAmount: (value) => Number(value || 0),
  tenantBranding: { key: 'mg', displayName: 'MG' },
  user: { name: 'Tester', company: 'mg' },
  branding: {
    companyName: 'MODERN GOLD JEWELRY MANUFACTURING FE LLC',
    address: 'Namangan, Uzbekistan',
  },
  defaultBranding: { companyName: 'LoopC', logoWidth: 120, logoHeight: 90 },
  statementFilters: { startDate: '2026-02-20', endDate: '2026-07-20' },
}

describe('exportStatementPdf', () => {
  beforeEach(() => {
    save.mockClear()
    autoTable.mockClear()
    jsPDF.mockClear()
    createLogoRenderAsset.mockClear()
    ensurePdfUnicodeFonts.mockClear()
    docApi.lastAutoTable = null
    docApi.setFont.mockClear()
  })

  test('builds landscape autoTable PDF and saves file', async () => {
    await exportStatementPdf(baseCtx, 'Statement-101001-2026-07-31.pdf')

    expect(jsPDF).toHaveBeenCalledWith({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    expect(ensurePdfUnicodeFonts).toHaveBeenCalledWith(docApi)
    expect(autoTable).toHaveBeenCalledWith(docApi, expect.objectContaining({
      showHead: 'everyPage',
      styles: expect.objectContaining({ font: 'NotoSans' }),
      headStyles: expect.objectContaining({ font: 'NotoSans' }),
      head: expect.arrayContaining([
        expect.arrayContaining([
          expect.objectContaining({ content: 'Doc No', rowSpan: 2 }),
          expect.objectContaining({ content: 'Amount (USD)', colSpan: 3 }),
          expect.objectContaining({ content: 'XAU(GMS)', colSpan: 3 }),
        ]),
        ['Debit', 'Credit', 'Balance', 'Debit', 'Credit', 'Balance'],
      ]),
      body: expect.arrayContaining([
        expect.arrayContaining(['', '', 'Balance B/F']),
        expect.arrayContaining(['Rec/2026/0001', expect.any(String), 'Свободная покупка у юр лиц']),
        expect.arrayContaining(['', '', 'Balance C/F']),
      ]),
    }))
    expect(docApi.setFont).toHaveBeenCalledWith('NotoSans', expect.any(String))
    expect(save).toHaveBeenCalledWith('Statement-101001-2026-07-31.pdf')
  })

  test('rejects when account enquiry data is missing', async () => {
    await expect(exportStatementPdf({ ...baseCtx, accountEnquiryData: null }, 'x.pdf'))
      .rejects.toThrow('Statement data not ready')
  })
})
