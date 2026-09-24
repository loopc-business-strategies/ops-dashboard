import { describe, expect, test } from 'vitest'
import { resolveProductTypeGrossWeight } from './resolveProductTypeGrossWeight'

describe('resolveProductTypeGrossWeight', () => {
  test('preserves existing gross when PCS is empty (edit-open case)', () => {
    // 14k alloy catalog Wt=1 must not wipe a saved purchase line of 1000g
    expect(resolveProductTypeGrossWeight({
      unitWeight: 1,
      pcs: 0,
      existingGrossWeight: 1000,
    })).toBe(1000)
  })

  test('uses unitWeight × pcs when pieces are set', () => {
    expect(resolveProductTypeGrossWeight({
      unitWeight: 1,
      pcs: 5,
      existingGrossWeight: 1000,
    })).toBe(5)
  })

  test('falls back to catalog unit weight on a new empty line', () => {
    expect(resolveProductTypeGrossWeight({
      unitWeight: 1,
      pcs: 0,
      existingGrossWeight: 0,
    })).toBe(1)
  })

  test('keeps existing gross when product has no unit weight', () => {
    expect(resolveProductTypeGrossWeight({
      unitWeight: 0,
      pcs: 0,
      existingGrossWeight: 1000,
    })).toBe(1000)
  })

  test('returns 0 when nothing is available', () => {
    expect(resolveProductTypeGrossWeight({
      unitWeight: 0,
      pcs: 0,
      existingGrossWeight: 0,
    })).toBe(0)
  })
})
