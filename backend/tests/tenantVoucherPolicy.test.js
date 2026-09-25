const {
  getDisabledVoucherTypes,
  isVoucherTypeEnabledForTenant,
  filterTransactionTypesForTenant,
  isLoopcOnlyVoucherType,
} = require('../config/tenantVoucherPolicy')

describe('tenantVoucherPolicy', () => {
  test('metal_transfer is LoopC-only allowlist', () => {
    expect(isLoopcOnlyVoucherType('metal_transfer')).toBe(true)
    expect(isVoucherTypeEnabledForTenant('loopc', 'metal_transfer')).toBe(true)
    expect(isVoucherTypeEnabledForTenant('mg', 'metal_transfer')).toBe(false)
    expect(isVoucherTypeEnabledForTenant('cg', 'metal_transfer')).toBe(false)
    expect(isVoucherTypeEnabledForTenant('vb', 'metal_transfer')).toBe(false)
    expect(isVoucherTypeEnabledForTenant('unknown', 'metal_transfer')).toBe(false)
    expect(isVoucherTypeEnabledForTenant('', 'metal_transfer')).toBe(false)
  })

  test('mg/cg/vb keep other metal vouchers enabled', () => {
    expect(isVoucherTypeEnabledForTenant('mg', 'purchase')).toBe(true)
    expect(isVoucherTypeEnabledForTenant('mg', 'metal_receipt')).toBe(true)
    expect(isVoucherTypeEnabledForTenant('mg', 'sale')).toBe(true)
    expect(isVoucherTypeEnabledForTenant('mg', 'metal_payment')).toBe(true)
  })

  test('getDisabledVoucherTypes includes metal_transfer for non-loopc', () => {
    expect(getDisabledVoucherTypes('mg')).toEqual(expect.arrayContaining(['metal_transfer']))
    expect(getDisabledVoucherTypes('cg')).toEqual(expect.arrayContaining(['metal_transfer']))
    expect(getDisabledVoucherTypes('vb')).toEqual(expect.arrayContaining(['metal_transfer']))
    expect(getDisabledVoucherTypes('loopc')).not.toEqual(expect.arrayContaining(['metal_transfer']))
    expect(getDisabledVoucherTypes('other')).toEqual(expect.arrayContaining(['metal_transfer']))
  })

  test('filterTransactionTypesForTenant removes metal_transfer off loopc', () => {
    const types = ['purchase', 'sale', 'metal_receipt', 'metal_payment', 'metal_transfer']
    expect(filterTransactionTypesForTenant('mg', types)).toEqual(['purchase', 'sale', 'metal_receipt', 'metal_payment'])
    expect(filterTransactionTypesForTenant('loopc', types)).toEqual(types)
  })
})
