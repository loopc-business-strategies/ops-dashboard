const {
  createAccountCodeService,
  isCompatibleAccountParentType,
} = require('../../services/erpAccounting/accountCodeService')

describe('accountCodeService', () => {
  test('allows Expense under Income for Cost of Goods under Sales Revenue', () => {
    expect(isCompatibleAccountParentType('Income', 'Expense')).toBe(true)
    expect(isCompatibleAccountParentType('Expense', 'Expense')).toBe(true)
    expect(isCompatibleAccountParentType('Income', 'Income')).toBe(true)
    expect(isCompatibleAccountParentType('Asset', 'Expense')).toBe(false)
    expect(isCompatibleAccountParentType('Expense', 'Income')).toBe(false)
  })

  test('validateAccountParentAssignment allows Expense child under Income parent', async () => {
    const incomeId = 'income-4000'
    const ChartOfAccount = {
      findById: jest.fn((id) => ({
        select: jest.fn(async () => {
          if (String(id) === incomeId) {
            return { parentAccountId: null, accountType: 'Income' }
          }
          return null
        }),
      })),
    }
    const { validateAccountParentAssignment } = createAccountCodeService({
      ChartOfAccount,
      BASE_CURRENCY_CODE: 'AED',
    })
    await expect(validateAccountParentAssignment({
      parentAccountId: incomeId,
      accountType: 'Expense',
    })).resolves.toBeUndefined()
  })

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
