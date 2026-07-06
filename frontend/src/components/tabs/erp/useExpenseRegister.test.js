import { describe, expect, it } from 'vitest'
import { cleanExpenseRegisterParams } from './useExpenseRegister'

describe('cleanExpenseRegisterParams', () => {
  it('omits empty values and paymentSource=all', () => {
    expect(cleanExpenseRegisterParams({
      startDate: '2026-01-01',
      endDate: '2026-07-06',
      category: '',
      paymentSource: 'all',
      limit: 200,
    })).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-07-06',
      limit: 200,
    })
  })

  it('keeps paymentSource when filtered', () => {
    expect(cleanExpenseRegisterParams({
      paymentSource: 'bank',
      category: 'Operating Expenses',
    })).toEqual({
      paymentSource: 'bank',
      category: 'Operating Expenses',
    })
  })
})
