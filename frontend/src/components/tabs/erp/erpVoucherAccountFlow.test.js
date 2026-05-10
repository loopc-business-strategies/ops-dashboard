import { describe, expect, test } from 'vitest'
import {
  accountLookupText,
  createTransactionForm,
  resolveAccountIdFromInput,
} from './erpTabUtils'

describe('ERP voucher/account helper flow', () => {
  const accountOptions = [
    { _id: 'cash-id', accountCode: '1100', accountName: 'Cash Account' },
    { _id: 'sales-id', accountCode: '4100', accountName: 'Sales Revenue' },
  ]

  test('starts voucher forms with safe accounting defaults', () => {
    const form = createTransactionForm()

    expect(form.type).toBe('expense')
    expect(form.currency).toBe('USD')
    expect(form.exchangeRate).toBe('1')
    expect(form.metalFixStatus).toBe('fixed')
    expect(form.debitAccountId).toBe('')
    expect(form.creditAccountId).toBe('')
  })

  test('resolves account selection by id, code, and visible label', () => {
    expect(accountLookupText(accountOptions[0])).toBe('1100 - Cash Account')
    expect(resolveAccountIdFromInput('cash-id', accountOptions)).toBe('cash-id')
    expect(resolveAccountIdFromInput('4100', accountOptions)).toBe('sales-id')
    expect(resolveAccountIdFromInput('1100 - Cash Account', accountOptions)).toBe('cash-id')
    expect(resolveAccountIdFromInput('missing', accountOptions)).toBe('')
  })
})
