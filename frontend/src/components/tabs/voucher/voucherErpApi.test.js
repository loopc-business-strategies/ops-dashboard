import { describe, expect, it } from 'vitest'
import { runVoucherWorkflowAction, voucherErpApi } from './voucherErpApi'

describe('voucherErpApi', () => {
  it('exports erpAccountingAPI facade methods', () => {
    expect(typeof voucherErpApi.getTransactions).toBe('function')
    expect(typeof voucherErpApi.voidTransaction).toBe('function')
    expect(typeof voucherErpApi.revalueFxJournal).toBe('function')
  })

  it('runVoucherWorkflowAction rejects unknown actions', async () => {
    await expect(runVoucherWorkflowAction('token', 'id', 'invalid', {})).rejects.toThrow(/Unknown voucher workflow/)
  })
})
