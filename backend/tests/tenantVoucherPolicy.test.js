const {
  getDisabledVoucherTypes,
  isVoucherTypeEnabledForTenant,
  filterTransactionTypesForTenant,
  isLoopcOnlyVoucherType,
} = require('../config/tenantVoucherPolicy')

const TENANTS = ['mg', 'cg', 'loopc', 'vb']

describe('tenantVoucherPolicy', () => {
  test('metal_transfer is enabled for every tenant', () => {
    expect(isLoopcOnlyVoucherType('metal_transfer')).toBe(false)
    for (const tenant of TENANTS) {
      expect(isVoucherTypeEnabledForTenant(tenant, 'metal_transfer')).toBe(true)
    }
  })

  test('all tenants keep the other metal vouchers enabled', () => {
    for (const tenant of TENANTS) {
      for (const type of ['purchase', 'sale', 'metal_receipt', 'metal_payment']) {
        expect(isVoucherTypeEnabledForTenant(tenant, type)).toBe(true)
      }
    }
  })

  test('getDisabledVoucherTypes no longer lists metal_transfer', () => {
    for (const tenant of TENANTS) {
      expect(getDisabledVoucherTypes(tenant)).not.toEqual(expect.arrayContaining(['metal_transfer']))
    }
  })

  test('filterTransactionTypesForTenant keeps metal_transfer', () => {
    const types = ['purchase', 'sale', 'metal_receipt', 'metal_payment', 'metal_transfer']
    for (const tenant of TENANTS) {
      expect(filterTransactionTypesForTenant(tenant, types)).toEqual(types)
    }
  })
})
