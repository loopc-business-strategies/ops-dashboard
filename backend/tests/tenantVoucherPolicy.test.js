const {
  getDisabledVoucherTypes,
  isVoucherTypeEnabledForTenant,
  filterTransactionTypesForTenant,
} = require('../config/tenantVoucherPolicy')

describe('tenantVoucherPolicy', () => {
  test('mg/cg/vb disable metal_transfer only', () => {
    expect(getDisabledVoucherTypes('mg')).toEqual(['metal_transfer'])
    expect(getDisabledVoucherTypes('cg')).toEqual(['metal_transfer'])
    expect(getDisabledVoucherTypes('vb')).toEqual(['metal_transfer'])
    expect(isVoucherTypeEnabledForTenant('mg', 'purchase')).toBe(true)
    expect(isVoucherTypeEnabledForTenant('mg', 'metal_receipt')).toBe(true)
    expect(isVoucherTypeEnabledForTenant('mg', 'sale')).toBe(true)
    expect(isVoucherTypeEnabledForTenant('mg', 'metal_payment')).toBe(true)
    expect(isVoucherTypeEnabledForTenant('mg', 'metal_transfer')).toBe(false)
    expect(isVoucherTypeEnabledForTenant('cg', 'metal_transfer')).toBe(false)
    expect(isVoucherTypeEnabledForTenant('vb', 'metal_transfer')).toBe(false)
  })

  test('loopc keeps metal_transfer enabled', () => {
    expect(getDisabledVoucherTypes('loopc')).toEqual([])
    expect(isVoucherTypeEnabledForTenant('loopc', 'metal_receipt')).toBe(true)
    expect(isVoucherTypeEnabledForTenant('loopc', 'metal_transfer')).toBe(true)
  })

  test('filterTransactionTypesForTenant removes metal_transfer on mg', () => {
    const filtered = filterTransactionTypesForTenant('mg', ['purchase', 'sale', 'metal_receipt', 'metal_payment', 'metal_transfer'])
    expect(filtered).toEqual(['purchase', 'sale', 'metal_receipt', 'metal_payment'])
  })
})
