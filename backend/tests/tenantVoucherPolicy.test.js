const {
  getDisabledVoucherTypes,
  isVoucherTypeEnabledForTenant,
  filterTransactionTypesForTenant,
} = require('../config/tenantVoucherPolicy')

describe('tenantVoucherPolicy', () => {
  test('no tenants disable voucher types by default', () => {
    expect(getDisabledVoucherTypes('mg')).toEqual([])
    expect(isVoucherTypeEnabledForTenant('mg', 'purchase')).toBe(true)
    expect(isVoucherTypeEnabledForTenant('mg', 'metal_receipt')).toBe(true)
    expect(isVoucherTypeEnabledForTenant('mg', 'sale')).toBe(true)
    expect(isVoucherTypeEnabledForTenant('mg', 'metal_payment')).toBe(true)
  })

  test('other tenants keep all voucher types enabled', () => {
    expect(getDisabledVoucherTypes('cg')).toEqual([])
    expect(isVoucherTypeEnabledForTenant('cg', 'purchase')).toBe(true)
    expect(isVoucherTypeEnabledForTenant('loopc', 'metal_receipt')).toBe(true)
  })

  test('filterTransactionTypesForTenant leaves types unchanged when none disabled', () => {
    const filtered = filterTransactionTypesForTenant('mg', ['purchase', 'sale', 'metal_receipt', 'metal_payment'])
    expect(filtered).toEqual(['purchase', 'sale', 'metal_receipt', 'metal_payment'])
  })
})
