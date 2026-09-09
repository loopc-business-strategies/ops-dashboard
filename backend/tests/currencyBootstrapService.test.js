const {
  DEFAULT_CURRENCY_MASTER,
  VB_CURRENCY_MASTER,
  getCurrencyMasterForTenant,
} = require('../services/erpAccounting/currencyBootstrapService')

describe('currencyBootstrapService tenant masters', () => {
  test('returns full master for mg/cg/loopc and default', () => {
    expect(getCurrencyMasterForTenant('mg')).toEqual(DEFAULT_CURRENCY_MASTER)
    expect(getCurrencyMasterForTenant('cg')).toEqual(DEFAULT_CURRENCY_MASTER)
    expect(getCurrencyMasterForTenant('loopc')).toEqual(DEFAULT_CURRENCY_MASTER)
    expect(getCurrencyMasterForTenant('')).toEqual(DEFAULT_CURRENCY_MASTER)
  })

  test('returns USD + AED only for vb', () => {
    expect(getCurrencyMasterForTenant('vb')).toEqual(VB_CURRENCY_MASTER)
    expect(getCurrencyMasterForTenant('VB')).toEqual(VB_CURRENCY_MASTER)
    expect(VB_CURRENCY_MASTER.map((row) => row.code)).toEqual(['USD', 'AED'])
    expect(VB_CURRENCY_MASTER.find((row) => row.code === 'USD')?.baseCurrency).toBe(true)
    expect(VB_CURRENCY_MASTER.find((row) => row.code === 'AED')?.baseCurrency).toBe(false)
  })
})
