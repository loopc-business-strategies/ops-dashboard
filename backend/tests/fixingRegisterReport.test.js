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

  test('an alloy purchase stays on the alloy statement and off the gold statement', () => {
    const alloyPurchase = {
      _id: 'p3',
      type: 'purchase',
      status: 'posted',
      amount: 90.02,
      voucherMeta: {
        vocNo: 'Pur/2026/0003',
        fixingType: 'fixing',
        lineItems: [{
          productType: '14k alloy',
          narration: '14K alloy purchased',
          pureWeight: 1000,
          totalAmount: 90.02,
        }],
      },
    }
    const goldPurchase = {
      _id: 'p2',
      type: 'purchase',
      status: 'posted',
      amount: 1000,
      voucherMeta: {
        vocNo: 'Pur/2026/0001',
        fixingType: 'fixing',
        lineItems: [{ stockCode: 'GOLD', narration: '14 k chain bought from gold invest', pureWeight: 5.88, totalAmount: 1000 }],
      },
    }
    const filter = { status: 'preview', partyFilter: 'all', groupBy: 'none', orderBy: 'voucherNo' }
    const alloyMatch = buildMetalMatchers('ALLOY::stock-alloy')
    const alloyRows = buildFixingRegisterRows({
      txSales: [],
      txPurchases: [alloyPurchase, goldPurchase],
      directDeals: [],
      fixingRegFilter: filter,
      matchesSelectedMetal: alloyMatch.matchesSelectedMetal,
      isAllMetalSelection: alloyMatch.isAllMetalSelection,
    })
    expect(alloyRows.map((row) => row.voucherNo)).toEqual(['Pur/2026/0003'])
    expect(alloyRows[0].metal).toBe('ALLOY')

    const goldMatch = buildMetalMatchers('XAU::stock-gold')
    const goldRows = buildFixingRegisterRows({
      txSales: [],
      txPurchases: [alloyPurchase, goldPurchase],
      directDeals: [],
      fixingRegFilter: filter,
      matchesSelectedMetal: goldMatch.matchesSelectedMetal,
      isAllMetalSelection: goldMatch.isAllMetalSelection,
    })
    expect(goldRows.map((row) => row.voucherNo)).toEqual(['Pur/2026/0001'])
  })

  test('a fixing of an unfixed purchase counts as an MG buy on the fixing date', () => {
    const { matchesSelectedMetal, isAllMetalSelection } = buildMetalMatchers('ALL')
    const tx = {
      _id: 'p1',
      type: 'purchase',
      status: 'posted',
      voucherMeta: {
        vocNo: 'Pur/2026/0001',
        fixingType: 'non-fixing',
        lineItems: [{ stockCode: 'GOLD', pureWeight: 199.98, premiumAmount: 0 }],
      },
      customerId: { name: 'UZEX' },
    }
    const fixing = {
      _id: 'f1',
      date: '2026-10-08',
      pureWeight: 199.98,
      metalCode: 'XAU',
      rate: 4126.13,
      rateType: 'OZ',
      amount: 26531.13,
    }
    const rows = buildFixingRegisterRows({
      txSales: [],
      txPurchases: [tx],
      directDeals: [],
      voucherFixings: [{ tx, fixing }],
      fixingRegFilter: { status: 'all', partyFilter: 'all', groupBy: 'none', orderBy: 'voucherNo' },
      matchesSelectedMetal,
      isAllMetalSelection,
    })
    const fixingRow = rows.find((row) => row.sourceType === 'Voucher Fixing')
    expect(fixingRow).toMatchObject({ direction: 'buy', fixingMode: 'Fixing', metal: 'XAU', amount: 26531.13 })
    expect(fixingRow.price).toBeCloseTo(4126.13, 2)
    const totals = computeOpening(rows)
    expect(totals.qtyOz).toBeCloseTo(199.98 / 31.1034768, 6)
  })
})
