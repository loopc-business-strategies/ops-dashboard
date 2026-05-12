const {
  accountCreateSchema,
  transactionCreateSchema,
  ledgerEntrySchema,
  hardDeleteSchema,
} = require('../routes/erp-accounting/schemas')

describe('ERP accounting schemas contract', () => {
  test('accountCreateSchema accepts valid payload', () => {
    const payload = {
      accountName: 'Cash on Hand',
      accountCode: '1000',
      accountType: 'Asset',
      currency: 'USD',
      description: 'Primary cash account',
    }

    const { error, value } = accountCreateSchema.validate(payload)
    expect(error).toBeUndefined()
    expect(value.accountCode).toBe('1000')
  })

  test('accountCreateSchema rejects missing required fields', () => {
    const { error } = accountCreateSchema.validate({ accountCode: '1001' })
    expect(error).toBeDefined()
  })

  test('transactionCreateSchema rejects unsupported transaction type', () => {
    const payload = {
      type: 'transfer',
      amount: 100,
      description: 'Unsupported type',
    }

    const { error } = transactionCreateSchema.validate(payload)
    expect(error).toBeDefined()
  })

  test('ledgerEntrySchema allows unknown fields', () => {
    const payload = {
      description: 'Manual ledger note',
      debitAmount: 50,
      customTraceId: 'trace-123',
    }

    const { error, value } = ledgerEntrySchema.validate(payload)
    expect(error).toBeUndefined()
    expect(value.customTraceId).toBe('trace-123')
  })

  test('hardDeleteSchema requires code', () => {
    const { error } = hardDeleteSchema.validate({})
    expect(error).toBeDefined()

    const ok = hardDeleteSchema.validate({ code: 'CONFIRM_DELETE' })
    expect(ok.error).toBeUndefined()
  })
})
