import { describe, expect, test } from 'vitest'
import { fmtMoveRow, fmtSpot, resolveLiveMetalKey } from '../utils/liveMetalRates'

describe('liveMetalRates helpers', () => {
  test('maps stock type names to live metal keys', () => {
    expect(resolveLiveMetalKey('Gold')).toBe('gold')
    expect(resolveLiveMetalKey('Silver')).toBe('silver')
    expect(resolveLiveMetalKey('Platinum')).toBe('platinum')
    expect(resolveLiveMetalKey('Copper')).toBeNull()
  })

  test('formats spot prices', () => {
    expect(fmtSpot(4527.39)).toBe('4,527.39')
    expect(fmtSpot(0)).toBe('—')
  })

  test('formats move row with percent change', () => {
    const move = fmtMoveRow(1.25, 4527.39)
    expect(move?.up).toBe(true)
    expect(move?.arrow).toBe('▲')
    expect(move?.rest).toContain('+0.03%')
  })
})
