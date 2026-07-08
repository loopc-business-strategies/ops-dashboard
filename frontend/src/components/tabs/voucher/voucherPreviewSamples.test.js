import { describe, expect, test } from 'vitest'
import {
  buildVoucherPreviewContext,
  buildVoucherPreviewPrintModel,
} from './voucherPreviewSamples'

describe('voucherPreviewSamples', () => {
  test('empty preview returns blank header and no line items', () => {
    const ctx = buildVoucherPreviewContext({
      mode: 'empty',
      voucherType: 'payment',
      branding: { companyName: 'LoopC' },
      user: { company: 'loopc', name: 'Tester' },
    })
    expect(ctx.header.vocNo).toBe('')
    expect(ctx.effectiveLineItems).toEqual([])
    expect(ctx.totals.grandTotal).toBe(0)
  })

  test('sample preview returns mock lines and totals', () => {
    const ctx = buildVoucherPreviewContext({
      mode: 'sample',
      voucherType: 'payment',
      branding: { companyName: 'LoopC' },
      user: { company: 'loopc', name: 'Tester' },
    })
    expect(ctx.header.vocNo).toBe('PAY-0001')
    expect(ctx.effectiveLineItems.length).toBe(2)
    expect(ctx.totals.grandTotal).toBe(1500)
  })

  test('sample metal preview uses metal line shape', () => {
    const ctx = buildVoucherPreviewContext({
      mode: 'sample',
      voucherType: 'purchase',
      branding: { companyName: 'LoopC' },
      user: { company: 'loopc', name: 'Tester' },
    })
    expect(ctx.isMetalVoucher).toBe(true)
    expect(ctx.effectiveLineItems[0].metalSymbol).toBe('XAU')
    expect(ctx.totals.grandTotal).toBeGreaterThan(0)
  })

  test('buildVoucherPreviewPrintModel includes LOOPC voucher print settings', () => {
    const model = buildVoucherPreviewPrintModel({
      mode: 'sample',
      voucherType: 'receipt',
      branding: {
        companyName: 'LoopC Trading',
        voucherPrint: {
          tableHeaders: { no: 'S.No' },
          signatories: [{ title: 'Receiver', name: 'Sam', visible: true }],
        },
      },
      user: { company: 'loopc', name: 'Tester' },
    })
    expect(model.printTitle).toBe('Receipt Voucher')
    expect(model.voucherPrintSettings.enabled).toBe(true)
    expect(model.voucherPrint.tableHeaders.no).toBe('S.No')
    expect(model.effectiveLineItems.length).toBe(2)
  })
})
