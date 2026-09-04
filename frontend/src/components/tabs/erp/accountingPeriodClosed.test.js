import { describe, expect, it } from 'vitest'
import {
  getAccountingPeriodClosedMessage,
  isAccountingPeriodClosedError,
  getAccountingEntry24hLockedMessage,
  getAccountingEntryLockMessage,
  isDateLocked,
  isPast24HourWindow,
  effectiveMonthStatus,
  accountingDateFromEntry,
} from './accountingPeriodClosed'

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

  it('detects ACCOUNTING_ENTRY_24H_LOCKED API errors', () => {
    const err = {
      response: {
        data: {
          code: 'ACCOUNTING_ENTRY_24H_LOCKED',
          message: 'This accounting entry is locked because more than 24 hours have passed since it was created.',
        },
      },
    }
    expect(getAccountingEntry24hLockedMessage(err)).toMatch(/24 hours/)
    expect(getAccountingEntryLockMessage(err)).toMatch(/24 hours/)
  })

  it('returns null for unrelated errors', () => {
    expect(getAccountingPeriodClosedMessage({ response: { data: { message: 'Forbidden' } } })).toBeNull()
  })

  it('isDateLocked when yearly CLOSED', () => {
    const date = new Date(Date.UTC(2026, 5, 15))
    expect(isDateLocked(date, {
      yearly: { status: 'CLOSED' },
      months: [{ month: 6, status: 'OPEN' }],
    })).toBe(true)
  })

  it('isDateLocked when month CLOSED and year OPEN', () => {
    const date = new Date(Date.UTC(2026, 0, 10))
    expect(isDateLocked(date, {
      yearly: { status: 'OPEN' },
      months: [{ month: 1, status: 'CLOSED' }],
    })).toBe(true)
    expect(isDateLocked(new Date(Date.UTC(2026, 1, 10)), {
      yearly: { status: 'OPEN' },
      months: [{ month: 1, status: 'CLOSED' }, { month: 2, status: 'OPEN' }],
    })).toBe(false)
  })

  it('effectiveMonthStatus cascades year CLOSED', () => {
    expect(effectiveMonthStatus({ month: 3, status: 'OPEN' }, { status: 'CLOSED' })).toBe('CLOSED')
    expect(effectiveMonthStatus({ month: 3, status: 'OPEN' }, { status: 'OPEN' })).toBe('OPEN')
    expect(effectiveMonthStatus({ month: 3, status: 'CLOSED' }, { status: 'OPEN' })).toBe('CLOSED')
  })

  it('accountingDateFromEntry prefers valueDate', () => {
    const d = accountingDateFromEntry({
      voucherMeta: { valueDate: '2026-03-15T00:00:00.000Z' },
      date: '2026-01-01T00:00:00.000Z',
    })
    expect(d.getUTCMonth()).toBe(2)
  })

  it('isPast24HourWindow boundary', () => {
    const createdAt = new Date('2026-09-04T10:00:00.000Z')
    const ms = 24 * 60 * 60 * 1000
    expect(isPast24HourWindow(createdAt, createdAt.getTime() + ms - 1)).toBe(false)
    expect(isPast24HourWindow(createdAt, createdAt.getTime() + ms)).toBe(true)
  })
})
