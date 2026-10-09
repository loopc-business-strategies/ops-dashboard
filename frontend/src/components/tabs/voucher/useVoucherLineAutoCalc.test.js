import { describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useVoucherLineAutoCalc } from './useVoucherLineAutoCalc'

function renderAutoCalc() {
  return renderHook(() => useVoucherLineAutoCalc({
    token: '',
    canView: false,
    voucherType: 'purchase',
    voucherErpApi: { getInventoryProducts: vi.fn() },
    latestMetalRates: {},
    showLineForm: false,
    setLineForm: vi.fn(),
    baseCurrencyCode: 'USD',
  })).result.current
}

describe('useVoucherLineAutoCalc', () => {
  test('OZ-rate metal amount uses the exact ounces, not the 3-decimal display', () => {
    const { applyLineAutoCalc } = renderAutoCalc()
    const line = applyLineAutoCalc({ grossWeight: '200', purity: '1', metalRate: '4099.09', rateType: 'OZ' })
    expect(line.weightInOz).toBe('6.430')
    expect(line.metalAmount).toBe('26357.76')
  })

  test('the rate typed next to UZS converts the line foreign amount and leaves the metal price in USD', () => {
    const { result } = renderHook(() => useVoucherLineAutoCalc({
      token: '',
      canView: false,
      voucherType: 'purchase',
      voucherErpApi: { getInventoryProducts: vi.fn() },
      latestMetalRates: {},
      showLineForm: false,
      setLineForm: vi.fn(),
      headerCurrCode: 'UZS',
      headerCurrRate: '11000',
      baseCurrencyCode: 'USD',
    }))
    const line = result.current.applyLineAutoCalc({ grossWeight: '10', purity: '0.999', metalRate: '4192.26', rateType: 'OZ', currCode: 'USD' })
    expect(line.metalRate).toBe('4192.26')
    expect(line.currRate).toBe('11000')
    expect(Number(line.amountLC)).toBeCloseTo(1346.5, 1)
    expect(line.amountFC).toBe(String(Math.round(Number(line.amountWithVAT) * 11000)))
  })
})
