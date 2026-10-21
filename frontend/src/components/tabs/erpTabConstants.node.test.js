import { describe, expect, test } from 'vitest'
import {
  ERP_DASH_DEFAULT,
  countErpDashGridRows,
} from './erpTabConstants.js'

describe('countErpDashGridRows', () => {
  test('default 9 widgets (span 2) occupy 3 rows', () => {
    expect(countErpDashGridRows(ERP_DASH_DEFAULT)).toBe(3)
  })

  test('six widgets occupy 2 rows', () => {
    expect(countErpDashGridRows(ERP_DASH_DEFAULT.slice(0, 6))).toBe(2)
  })

  test('empty list still returns 1', () => {
    expect(countErpDashGridRows([])).toBe(1)
  })
})
