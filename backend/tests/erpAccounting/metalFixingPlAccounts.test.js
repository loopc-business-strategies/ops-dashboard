const {
  metalDisplayName,
  resolveMetalCodeFromText,
  resolveVoucherMetalCode,
  ensureMetalFixingPlAccount,
} = require('../../services/erpAccounting/metalFixingPlAccounts')

describe('metalFixingPlAccounts', () => {
  test('metalDisplayName maps codes', () => {
    expect(metalDisplayName('XAU')).toBe('Gold')
    expect(metalDisplayName('XAG')).toBe('Silver')
    expect(metalDisplayName('XPT')).toBe('Platinum')
  })

  test('resolveMetalCodeFromText reads GOLD/SILVER labels', () => {
    expect(resolveMetalCodeFromText('GOLD')).toBe('XAU')
    expect(resolveMetalCodeFromText('Gold Bar')).toBe('XAU')
    expect(resolveMetalCodeFromText('XAG')).toBe('XAG')
    expect(resolveMetalCodeFromText('')).toBe('')
  })

  test('resolveVoucherMetalCode uses first metal line', () => {
    expect(resolveVoucherMetalCode({
      voucherMeta: { lineItems: [{ stockCode: 'GOLD', productType: 'Gold Bar' }] },
    })).toBe('XAU')
    expect(resolveVoucherMetalCode({ voucherMeta: { lineItems: [{ stockCode: 'CASH' }] } })).toBe('')
  })

  test('ensureMetalFixingPlAccount creates Sales Fixing under 4000', async () => {
    const parent = { _id: 'parent-4000' }
    const child = { _id: 'gold-sales-fixing', accountCode: '910001' }
    const ensureAccountByCode = jest.fn(async () => parent)
    const ensureChildAccountByName = jest.fn(async () => child)

    const result = await ensureMetalFixingPlAccount({
      user: { _id: 'u1' },
      kind: 'sales',
      metalCode: 'XAU',
      currency: 'USD',
      ensureAccountByCode,
      ensureChildAccountByName,
    })

    expect(result).toBe(child)
    expect(ensureAccountByCode).toHaveBeenCalledWith(expect.objectContaining({
      code: '4000',
      accountType: 'Income',
    }))
    expect(ensureChildAccountByName).toHaveBeenCalledWith(expect.objectContaining({
      accountName: 'Gold Sales Fixing',
      codePrefix: '91',
      accountType: 'Income',
    }))
  })

  test('ensureMetalFixingPlAccount creates Purchase Fixing under 5101', async () => {
    const parent = { _id: 'parent-5101' }
    const child = { _id: 'gold-purchase-fixing', accountCode: '920001' }
    const ensureAccountByCode = jest.fn(async () => parent)
    const ensureChildAccountByName = jest.fn(async () => child)

    const result = await ensureMetalFixingPlAccount({
      user: { _id: 'u1' },
      kind: 'purchase',
      metalCode: 'XAU',
      currency: 'USD',
      ensureAccountByCode,
      ensureChildAccountByName,
    })

    expect(result).toBe(child)
    expect(ensureAccountByCode).toHaveBeenCalledWith(expect.objectContaining({
      code: '5101',
      accountType: 'Expense',
    }))
    expect(ensureChildAccountByName).toHaveBeenCalledWith(expect.objectContaining({
      accountName: 'Gold Purchase Fixing',
      codePrefix: '92',
      accountType: 'Expense',
    }))
  })
})
