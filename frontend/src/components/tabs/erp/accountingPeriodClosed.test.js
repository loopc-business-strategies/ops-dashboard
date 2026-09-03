import { describe, expect, it } from 'vitest'
import { getAccountingPeriodClosedMessage, isAccountingPeriodClosedError } from './accountingPeriodClosed'

describe('accountingPeriodClosed helpers', () => {
  it('detects ACCOUNTING_PERIOD_CLOSED API errors', () => {
    const err = {
      response: {
        data: {
          code: 'ACCOUNTING_PERIOD_CLOSED',
          message: 'January 2026 is closed. Accounting entries in this period cannot be modified.',
        },
      },
    }
    expect(isAccountingPeriodClosedError(err)).toBe(true)
    expect(getAccountingPeriodClosedMessage(err)).toContain('January 2026 is closed')
  })

  it('returns null for unrelated errors', () => {
    expect(getAccountingPeriodClosedMessage({ response: { data: { message: 'Forbidden' } } })).toBeNull()
  })
})
