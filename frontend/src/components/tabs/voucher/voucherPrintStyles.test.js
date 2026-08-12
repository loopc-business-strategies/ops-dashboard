import { describe, expect, test } from 'vitest'
import {
  VOUCHER_COL_AMOUNT,
  VOUCHER_COL_NO,
  VOUCHER_PRINT_MEDIA_CSS,
  VOUCHER_TABLE_FONT_SIZE,
  getVoucherPrintMediaCss,
  getVoucherSheetStyle,
} from './voucherPrintStyles'

describe('voucherPrintStyles', () => {
  test('exports 14px table typography and wider amount columns', () => {
    expect(VOUCHER_TABLE_FONT_SIZE).toBe(14)
    expect(VOUCHER_COL_NO).toBe('48px')
    expect(VOUCHER_COL_AMOUNT).toBe('124px')
  })

  test('preview sheet caps width and print sheet enforces min-width', () => {
    expect(getVoucherSheetStyle(true).maxWidth).toBe('820px')
    expect(getVoucherSheetStyle(false).minWidth).toBe('1050px')
    expect(getVoucherSheetStyle(false).padding).toBe('18px 24px 24px')
  })

  test('print media CSS targets voucher-print-only layer', () => {
    expect(VOUCHER_PRINT_MEDIA_CSS).toContain('.voucher-print-only')
    expect(VOUCHER_PRINT_MEDIA_CSS).toContain('@media print')
    expect(VOUCHER_PRINT_MEDIA_CSS).toContain('@page { size: A4 portrait')
  })

  test('print media CSS stays compact and does not pin signatures to the page bottom', () => {
    expect(VOUCHER_PRINT_MEDIA_CSS).toContain('display: block !important')
    expect(VOUCHER_PRINT_MEDIA_CSS).not.toContain('min-height: calc(297mm')
    expect(VOUCHER_PRINT_MEDIA_CSS).not.toContain('margin-top: auto')
    expect(getVoucherPrintMediaCss('A5')).toContain('@page { size: A5 portrait')
    expect(getVoucherPrintMediaCss('Letter')).toContain('@page { size: Letter portrait')
    expect(getVoucherPrintMediaCss('legal')).toContain('@page { size: A4 portrait')
  })
})
