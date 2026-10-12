import { describe, expect, it } from 'vitest'
import {
  convertReportUsd,
  reportCurrencyChoices,
  reportDisplayPerUsd,
  reportMoneyColumns,
  formatReportGrams,
  trialMoneyHeaders,
  trialMoneyValues,
} from './reportDisplayOptions'

const currencies = [
  { code: 'USD', exchangeRate: 1, baseCurrency: true, isActive: true },
  { code: 'AED', exchangeRate: 0.2723, isActive: true },
  { code: 'UZS', exchangeRate: 1 / 12100, isActive: true },
  { code: 'EUR', exchangeRate: 0, isActive: true },
]

describe('report display options', () => {
  it('converts the whole report at one master rate', () => {
    expect(reportDisplayPerUsd('USD', currencies, 'USD')).toBe(1)
    expect(reportDisplayPerUsd('UZS', currencies, 'USD')).toBeCloseTo(12100, 4)
    expect(convertReportUsd(100, 'UZS', currencies, 'USD')).toBeCloseTo(1210000, 2)
    expect(convertReportUsd(100, 'AED', currencies, 'USD')).toBeCloseTo(100 / 0.2723, 4)
    expect(convertReportUsd(100, 'USD', currencies, 'USD')).toBe(100)
  })

  it('keeps currencies that have a master rate', () => {
    expect(reportCurrencyChoices(currencies, 'USD')).toEqual(['USD', 'AED', 'UZS'])
  })

  it('shows the net column when Show Net Only is on', () => {
    expect(reportMoneyColumns({ showNetOnly: true, hideNet: true })).toEqual({
      debit: false,
      credit: false,
      net: true,
    })
    expect(trialMoneyHeaders(reportMoneyColumns({ showNetOnly: true }))).toEqual(['Net'])
    expect(trialMoneyValues({ debit: 10, credit: 4, net: 6 }, reportMoneyColumns({ hideNet: true }), (value) => value)).toEqual([10, 4])
  })

  it('prints gold and silver nets as grams with Dr or Cr', () => {
    expect(formatReportGrams(10)).toMatch(/10\.000 Dr/)
    expect(formatReportGrams(-4)).toMatch(/4\.000 Cr/)
    expect(formatReportGrams(0)).toBe('')
  })
})
