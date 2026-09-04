import { describe, expect, test } from 'vitest'
import { fmtMoney, fmtSigned } from '@/src/utils/format'

describe('fmtMoney / fmtSigned currency precision', () => {
  test('fmtMoney uses currency precision (UZS = 0dp)', () => {
    expect(fmtMoney(2000, 'UZS')).toBe('2,000 UZS')
    expect(fmtMoney(2000.4, 'UZS')).toBe('2,000 UZS')
  })

  test('fmtMoney keeps 2dp for USD', () => {
    expect(fmtMoney(2000, 'USD')).toBe('USD 2,000.00')
  })

  test('fmtMoney uses 3dp for BHD', () => {
    expect(fmtMoney(12.3456, 'BHD')).toBe('BHD 12.346')
  })

  test('fmtSigned prefixes sign and respects currency', () => {
    expect(fmtSigned(1500, 'UZS')).toBe('+1,500')
    expect(fmtSigned(-12.5, 'USD')).toBe('-12.50')
  })
})
