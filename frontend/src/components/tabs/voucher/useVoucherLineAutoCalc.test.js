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
})
