const {
  normalizeVoucherMetaFixingType,
  applyVoucherMetaFixingTypeAlias,
} = require('../../routes/erp-accounting/transactionHelpers')

describe('voucherMeta.fixingType aliases', () => {
  test('maps UI fixed/unfixed onto schema enum', () => {
    expect(normalizeVoucherMetaFixingType('fixed')).toBe('fixing')
    expect(normalizeVoucherMetaFixingType('fixing')).toBe('fixing')
    expect(normalizeVoucherMetaFixingType('unfixed')).toBe('non-fixing')
    expect(normalizeVoucherMetaFixingType('non_fixing')).toBe('non-fixing')
    expect(normalizeVoucherMetaFixingType('')).toBe('fixing')
  })

  test('applyVoucherMetaFixingTypeAlias rewrites only when present', () => {
    expect(applyVoucherMetaFixingTypeAlias(null)).toBe(null)
    expect(applyVoucherMetaFixingTypeAlias({ lineItems: [] })).toEqual({ lineItems: [] })
    expect(applyVoucherMetaFixingTypeAlias({ fixingType: 'fixed', lineItems: [] })).toEqual({
      fixingType: 'fixing',
      lineItems: [],
    })
  })
})
