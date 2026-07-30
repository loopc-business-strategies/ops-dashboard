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

  test('allocateNextVoucherDocNo picks max seq + 1 for type/year', async () => {
    const { allocateNextVoucherDocNo } = require('../utils/voucherDocNo')
    const TransactionModel = {
      find: () => ({
        select: () => ({
          limit: () => ({
            lean: async () => ([
              { voucherMeta: { vocNo: 'Pay/2026/0003' } },
              { voucherMeta: { vocNo: 'Pay/2026/0010' } },
              { voucherMeta: { vocNo: 'Pay/2025/0099' } },
            ]),
          }),
        }),
      }),
    }
    await expect(allocateNextVoucherDocNo(TransactionModel, 'payment', '2026-07-30')).resolves.toBe('Pay/2026/0011')
  })

  test('voucherDocNoExists returns true when an active row matches', async () => {
    const { voucherDocNoExists } = require('../utils/voucherDocNo')
    const TransactionModel = {
      findOne: () => ({
        select: () => ({
          lean: async () => ({ _id: 'abc' }),
        }),
      }),
    }
    await expect(voucherDocNoExists(TransactionModel, 'Pay/2026/0011')).resolves.toBe(true)
  })
})
