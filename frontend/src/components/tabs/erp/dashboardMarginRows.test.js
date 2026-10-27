import { describe, expect, test } from 'vitest'
import {
  filterAndSortDashboardMarginRows,
  hasNonZeroEquity,
} from './dashboardMarginRows'

describe('dashboardMarginRows', () => {
  test('hasNonZeroEquity hides exact and display-rounded zeros', () => {
    expect(hasNonZeroEquity({ equity: 0 })).toBe(false)
    expect(hasNonZeroEquity({ equity: 0.001 })).toBe(false)
    expect(hasNonZeroEquity({ equity: 0.01 })).toBe(true)
    expect(hasNonZeroEquity({ equity: -13 })).toBe(true)
  })

  test('filterAndSortDashboardMarginRows drops zeros and sorts equity desc by default', () => {
    const rows = [
      { name: 'Zero Co', equity: 0 },
      { name: 'Low Co', equity: -100 },
      { name: 'High Co', equity: 500 },
      { name: 'Tiny Co', equity: 0.002 },
    ]
    expect(filterAndSortDashboardMarginRows(rows).map((r) => r.name)).toEqual([
      'High Co',
      'Low Co',
    ])
  })

  test('filterAndSortDashboardMarginRows supports equity asc', () => {
    const rows = [
      { name: 'High Co', equity: 500 },
      { name: 'Low Co', equity: -100 },
      { name: 'Mid Co', equity: 50 },
    ]
    expect(filterAndSortDashboardMarginRows(rows, 'asc').map((r) => r.name)).toEqual([
      'Low Co',
      'Mid Co',
      'High Co',
    ])
  })
})
