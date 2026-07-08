import { describe, expect, test } from 'vitest'
import {
  areAllMonthsSelected,
  fromMonthCsv,
  includesSearchTerm,
  matchesYearMonths,
  normalizeFilterMonths,
  normalizeFilterSearchTerm,
  normalizeFilterYear,
  selectAllMonths,
  toMonthCsv,
} from './erpListFilters'

describe('erpListFilters utilities', () => {
  test('normalizes search and year values', () => {
    expect(normalizeFilterSearchTerm('  Voucher 001  ')).toBe('voucher 001')
    expect(normalizeFilterYear('2026')).toBe('2026')
    expect(normalizeFilterYear('26')).toBe('')
  })

  test('normalizes and serializes month selections', () => {
    expect(normalizeFilterMonths([3, '1', 3, 15, 0])).toEqual([1, 3])
    expect(selectAllMonths()).toHaveLength(12)
    expect(areAllMonthsSelected(selectAllMonths())).toBe(true)
    expect(toMonthCsv([3, 1, 2])).toBe('1,2,3')
    expect(fromMonthCsv('3,2,1,2')).toEqual([1, 2, 3])
  })

  test('matches date by year and selected months', () => {
    expect(matchesYearMonths('2026-07-08', '2026', [7])).toBe(true)
    expect(matchesYearMonths('2026-07-08', '2026', [6])).toBe(false)
    expect(matchesYearMonths('2026-07-08', '', [])).toBe(true)
  })

  test('checks text includes across multiple fields', () => {
    expect(includesSearchTerm(['REC/2026/0001', 'Shareholder'], 'holder')).toBe(true)
    expect(includesSearchTerm(['REC/2026/0001', 'Shareholder'], 'voucher')).toBe(false)
  })
})
