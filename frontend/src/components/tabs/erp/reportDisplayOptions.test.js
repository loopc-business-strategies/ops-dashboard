import { describe, expect, it } from 'vitest'
import {
  convertReportUsd,
  reportCurrencyChoices,
  reportMoneyHeaderLabels,
  reportSelectableCurrencies,
  reportDisplayPerUsd,
  reportMoneyColumns,
  buildClosingStockTrialRow,
  filterTrialRowsByGroup,
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

  it('offers USD or UZS for the report currency', () => {
    expect(reportSelectableCurrencies(currencies, 'USD')).toEqual(['USD', 'UZS'])
    expect(reportMoneyHeaderLabels('UZS')).toEqual({
      debit: 'Debit (UZS)',
      credit: 'Credit (UZS)',
      net: 'Net (UZS)',
    })
    expect(trialMoneyHeaders(reportMoneyColumns(), reportMoneyHeaderLabels('USD'))).toEqual([
      'Debit (USD)',
      'Credit (USD)',
      'Net (USD)',
    ])
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

  it('builds one unposted closing-stock row from the live market value', () => {
    expect(buildClosingStockTrialRow({
      marketValue: 500.004,
      metals: [{ metal: 'gold', netGrams: 10 }, { metal: 'silver', netGrams: -2 }],
    })).toMatchObject({
      accountName: 'Closing stock (open metal at live price)',
      net: 500,
      goldNet: 10,
      silverNet: -2,
      debit: 0,
      unposted: true,
    })
    expect(buildClosingStockTrialRow({ omitted: true })).toBeNull()
  })

  it('keeps one trial group from the account name', () => {
    const rows = [
      { accountName: 'test (Debtor)' },
      { accountName: 'supplier (Creditor)' },
      { accountName: 'Cash on Hand' },
      { accountName: 'NATIONAL BANK OF UZBEKISTAN-USD', accountType: 'Asset' },
      { accountName: 'Bank charges', accountType: 'Expense' },
      { accountName: 'Exchange Gain', accountType: 'Income' },
      { accountName: 'Closing stock (open metal at live price)', unposted: true },
    ]
    expect(filterTrialRowsByGroup(rows, 'debtor').map((row) => row.accountName)).toEqual(['test (Debtor)'])
    expect(filterTrialRowsByGroup(rows, 'bank').map((row) => row.accountName)).toEqual(['NATIONAL BANK OF UZBEKISTAN-USD'])
    expect(filterTrialRowsByGroup(rows, 'cash').map((row) => row.accountName)).toEqual(['Cash on Hand'])
    expect(filterTrialRowsByGroup(rows, '')).toHaveLength(7)
  })

  it('prints gold and silver nets as grams with Dr or Cr', () => {
    expect(formatReportGrams(10)).toMatch(/10\.000 Dr/)
    expect(formatReportGrams(-4)).toMatch(/4\.000 Cr/)
    expect(formatReportGrams(0)).toBe('')
  })
})
