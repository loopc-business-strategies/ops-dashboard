const { createAccountCodeService } = require('../../services/erpAccounting/accountCodeService')

describe('accountCodeService', () => {
  test('nextCustomerAccountCode returns first unused code starting at 1300', async () => {
    const exists = jest.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false)
    const ChartOfAccount = { exists }
    const { nextCustomerAccountCode } = createAccountCodeService({
      ChartOfAccount,
      BASE_CURRENCY_CODE: 'USD',
    })
    await expect(nextCustomerAccountCode()).resolves.toBe('1302')
    expect(exists).toHaveBeenCalledWith({ accountCode: '1300' })
    expect(exists).toHaveBeenCalledWith({ accountCode: '1301' })
    expect(exists).toHaveBeenCalledWith({ accountCode: '1302' })
  })
})
