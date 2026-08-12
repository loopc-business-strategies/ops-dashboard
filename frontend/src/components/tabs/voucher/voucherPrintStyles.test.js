import { describe, expect, test } from 'vitest'
import {
  VOUCHER_COL_AMOUNT,
  VOUCHER_COL_NO,
  VOUCHER_PRINT_MEDIA_CSS,
  VOUCHER_TABLE_FONT_SIZE,
  getVoucherPrintMediaCss,
  getVoucherPrintableWidthMm,
  getVoucherSheetStyle,
} from './voucherPrintStyles'

describe('voucherPrintStyles', () => {
  test('exports 14px table typography and wider amount columns', () => {
    expect(VOUCHER_TABLE_FONT_SIZE).toBe(14)
    expect(VOUCHER_COL_NO).toBe('48px')
    expect(VOUCHER_COL_AMOUNT).toBe('124px')
  })

  test('preview sheet caps width and print sheet fits the page', () => {
    expect(getVoucherSheetStyle(true).maxWidth).toBe('820px')
    expect(getVoucherSheetStyle(false).minWidth).toBeUndefined()
    expect(getVoucherSheetStyle(false).width).toBe('100%')
    expect(getVoucherSheetStyle(false).maxWidth).toBe('100%')
    expect(getVoucherSheetStyle(false).padding).toBe('18px 24px 24px')
  })

  test('print media CSS targets voucher-print-only layer', () => {
    expect(VOUCHER_PRINT_MEDIA_CSS).toContain('.voucher-print-only')
    expect(VOUCHER_PRINT_MEDIA_CSS).toContain('@media print')
    expect(VOUCHER_PRINT_MEDIA_CSS).toContain('@page { size: A4 portrait')
    expect(VOUCHER_PRINT_MEDIA_CSS).toContain('position: fixed !important')
    expect(VOUCHER_PRINT_MEDIA_CSS).toContain('inset: 0 !important')
    expect(VOUCHER_PRINT_MEDIA_CSS).toContain('max-width: none !important')
    expect(VOUCHER_PRINT_MEDIA_CSS).toContain('display: flex !important')
    expect(VOUCHER_PRINT_MEDIA_CSS).toContain('justify-content: center')
  })

  test('print media CSS stays compact and does not pin signatures to the page bottom', () => {
    expect(VOUCHER_PRINT_MEDIA_CSS).toContain('overflow: visible !important')
    expect(VOUCHER_PRINT_MEDIA_CSS).toContain('.voucher-print-sheet')
    expect(VOUCHER_PRINT_MEDIA_CSS).toContain('.voucher-print-signatures { gap: 24px !important; }')
    expect(VOUCHER_PRINT_MEDIA_CSS).toContain(`width: ${getVoucherPrintableWidthMm('A4')} !important`)
    expect(VOUCHER_PRINT_MEDIA_CSS).not.toContain('min-height: calc(297mm')
    expect(VOUCHER_PRINT_MEDIA_CSS).not.toContain('margin-top: auto')
    expect(getVoucherPrintMediaCss('A5')).toContain('@page { size: A5 portrait')
    expect(getVoucherPrintMediaCss('A5')).toContain(`width: ${getVoucherPrintableWidthMm('A5')} !important`)
    expect(getVoucherPrintMediaCss('Letter')).toContain('@page { size: Letter portrait')
    expect(getVoucherPrintMediaCss('Letter')).toContain(`width: ${getVoucherPrintableWidthMm('Letter')} !important`)
    expect(getVoucherPrintMediaCss('legal')).toContain('@page { size: A4 portrait')
  })
})
