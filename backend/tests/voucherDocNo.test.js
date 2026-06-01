const {
  parseAnyVoucherDocMeta,
  coerceVoucherDocNo,
  buildVoucherDocNo,
  normalizeVoucherMetaDocNo,
} = require('../utils/voucherDocNo')

describe('voucherDocNo', () => {
  test('parseAnyVoucherDocMeta reads any voucher prefix', () => {
    expect(parseAnyVoucherDocMeta('Pur/2026/0001')).toEqual({
      prefix: 'Pur',
      year: 2026,
      seq: 1,
      sortKey: 202600001,
    })
  })

  test('coerceVoucherDocNo re-prefixes metal transfer vouchers', () => {
    expect(coerceVoucherDocNo('metal_receipt', 'Pur/2026/0001', '2026-05-26')).toBe('MRec/2026/0001')
    expect(coerceVoucherDocNo('metal_payment', 'Pur/2026/0001', '2026-05-28')).toBe('MPay/2026/0001')
  })

  test('coerceVoucherDocNo keeps matching prefix unchanged', () => {
    expect(coerceVoucherDocNo('purchase', 'Pur/2026/0001', '2026-05-26')).toBe('Pur/2026/0001')
    expect(coerceVoucherDocNo('metal_receipt', 'MRec/2026/0002', '2026-05-26')).toBe('MRec/2026/0002')
  })

  test('buildVoucherDocNo uses type-specific prefix', () => {
    expect(buildVoucherDocNo('metal_payment', '2026-05-28', 3)).toBe('MPay/2026/0003')
  })

  test('normalizeVoucherMetaDocNo updates voucherMeta.vocNo', () => {
    expect(normalizeVoucherMetaDocNo('metal_receipt', {
      vocNo: 'Pur/2026/0001',
      docDate: '2026-05-26T00:00:00.000Z',
    })).toEqual({
      vocNo: 'MRec/2026/0001',
      docDate: '2026-05-26T00:00:00.000Z',
    })
  })
})
