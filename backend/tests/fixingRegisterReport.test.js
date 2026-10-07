const {
  buildFixingRegisterRows,
  computeOpening,
  buildMetalMatchers,
  fixingRegConvertToOz,
} = require('../services/erpAccounting/fixingRegisterReport')

describe('fixingRegisterReport', () => {
  test('convert oz units', () => {
    expect(fixingRegConvertToOz(31.1034768, 'GRAM')).toBeCloseTo(1, 6)
    expect(fixingRegConvertToOz(1, 'OZ')).toBe(1)
  })

  test('builds voucher + deal rows and opening qty', () => {
    const { matchesSelectedMetal, isAllMetalSelection } = buildMetalMatchers('ALL')
    const filter = {
      status: 'all',
      partyFilter: 'all',
      partySearch: '',
      groupBy: 'none',
      orderBy: 'voucherNo',
      excludeFutures: false,
      excludeOpeningBalance: false,
    }
    const txSales = [{
      _id: 's1',
      type: 'sale',
      status: 'posted',
      amount: 1000,
      description: 'Gold sale',
      voucherMeta: {
        vocNo: 'S-1',
        branch: 'HO',
        partyName: 'Acme',
        docDate: '2026-01-10',
        valueDate: '2026-01-10',
        fixingType: 'fixing',
        metalRate: 2000,
        lineItems: [{
          stockCode: 'XAU',
          pureWeight: 31.1034768,
          metalRate: 2000,
          totalAmount: 2000,
          narration: 'oz',
        }],
      },
      customerId: { name: 'Acme' },
    }]
    const deals = [{
      _id: 'd1',
      docNo: 'DD-1',
      entryType: 'fixing',
      docDate: '2026-01-05',
      valueDate: '2026-01-05',
      branch: 'HO',
      status: 'confirmed',
      remarks: '',
      lineItems: [{
        _id: 'l1',
        metal: 'XAU',
        qty: 1,
        stockCode: 'OZ',
        direction: 'buy',
        price: 1900,
        amount: 1900,
        customerName: 'Acme',
        eqOz: 1,
      }],
    }]
    const rows = buildFixingRegisterRows({
      txSales,
      txPurchases: [],
      directDeals: deals,
      fixingRegFilter: filter,
      matchesSelectedMetal,
      isAllMetalSelection,
    })
    expect(rows.length).toBe(2)
    const dealRow = rows.find((r) => r.voucherNo === 'DD-1')
    expect(dealRow.direction).toBe('sell')
    expect(dealRow.customerDirection).toBe('buy')
    const opening = computeOpening(rows.filter((r) => String(r.voucherNo).startsWith('DD')))
    expect(opening.qtyOz).toBeCloseTo(-1, 5)
  })

  test('customer buy deal and purchase voucher of the same weight leave MG flat', () => {
    const { matchesSelectedMetal, isAllMetalSelection } = buildMetalMatchers('ALL')
    const rows = buildFixingRegisterRows({
      txSales: [],
      txPurchases: [{
        _id: 'p1',
        type: 'purchase',
        status: 'posted',
        amount: 26541.18,
        voucherMeta: {
          vocNo: 'Pur/2026/0002',
          fixingType: 'fixing',
          lineItems: [{ stockCode: 'GOLD', pureWeight: 200, totalAmount: 26541.18 }],
        },
        customerId: { name: 'UZEX' },
      }],
      directDeals: [{
        _id: 'd2',
        docNo: 'ORD/2026/000001',
        entryType: 'fixing',
        docDate: '2026-10-07',
        valueDate: '2026-10-07',
        status: 'confirmed',
        lineItems: [{ _id: 'l2', metal: 'XAU', qty: 200, stockCode: 'GRAM', direction: 'buy', price: 4177.82, amount: 26863.96, customerName: 'UZEX' }],
      }],
      fixingRegFilter: { status: 'all', partyFilter: 'all', groupBy: 'none', orderBy: 'voucherNo' },
      matchesSelectedMetal,
      isAllMetalSelection,
    })
    const totals = computeOpening(rows)
    expect(totals.qtyOz).toBeCloseTo(0, 5)
    expect(totals.value).toBeCloseTo(26541.18 - 26863.96, 2)
  })
})
