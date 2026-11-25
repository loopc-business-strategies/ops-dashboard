import { describe, expect, test } from 'vitest'
import { buildVoucherListExportTable } from './voucherListExportHelpers'

describe('voucherListExportHelpers', () => {
  test('builds payment list columns and rows from filtered vouchers', () => {
    const { head, body, rowCount } = buildVoucherListExportTable({
      voucherType: 'payment',
      isSimpleMetalVoucher: false,
      baseCurrencyCode: 'USD',
      vouchers: [{
        type: 'payment',
        status: 'posted',
        currency: 'USD',
        date: '2026-04-16',
        voucherMeta: {
          vocNo: 'Pay/2026/0012',
          docDate: '2026-04-16',
          valueDate: '2026-04-16',
          partyCode: '2304',
          partyName: 'V.J ENTERPRISES (Creditor)',
        },
        amount: 23000,
      }],
    })

    expect(head).toEqual([
      'Doc No',
      'Doc Date',
      'Value Date',
      'Party Code',
      'Party Name',
      'Currency',
      'Grand Total',
      'Status',
    ])
    expect(rowCount).toBe(1)
    expect(body[0][0]).toMatch(/Pay\/2026\/0012|Pay/)
    expect(body[0][3]).toBe('2304')
    expect(body[0][4]).toBe('V.J ENTERPRISES (Creditor)')
    expect(body[0][5]).toBe('USD')
    expect(body[0][7]).toBe('posted')
  })

  test('omits value date and currency for simple metal vouchers', () => {
    const { head } = buildVoucherListExportTable({
      voucherType: 'metal_payment',
      isSimpleMetalVoucher: true,
      vouchers: [],
    })
    expect(head).toEqual(['Doc No', 'Doc Date', 'Party Code', 'Party Name', 'Grand Total', 'Status'])
    expect(head).not.toContain('Currency')
    expect(head).not.toContain('Value Date')
  })
})
