import { describe, expect, test } from 'vitest'
import { computeViewportBoardFit, shouldEnableBoardFit } from './useViewportBoardFit.js'

describe('computeViewportBoardFit fill mode', () => {
  test('exact 1920×1080 is identity fill', () => {
    expect(computeViewportBoardFit({ viewportWidth: 1920, viewportHeight: 1080, mode: 'fill' })).toEqual({
      mode: 'fill',
      scaleX: 1,
      scaleY: 1,
      layoutWidth: 1920,
      layoutHeight: 1080,
      offsetLeft: 0,
      offsetTop: 0,
    })
  })

  test('4K stretches 1920×1080 board to fill', () => {
    const fit = computeViewportBoardFit({ viewportWidth: 3840, viewportHeight: 2160, mode: 'fill' })
    expect(fit.scaleX).toBe(2)
    expect(fit.scaleY).toBe(2)
    expect(fit.layoutWidth * fit.scaleX).toBe(3840)
    expect(fit.layoutHeight * fit.scaleY).toBe(2160)
  })

  test('non-16:9 still fills both axes (no empty side band)', () => {
    const fit = computeViewportBoardFit({ viewportWidth: 1920, viewportHeight: 900, mode: 'fill' })
    expect(fit.layoutWidth * fit.scaleX).toBeCloseTo(1920, 5)
    expect(fit.layoutHeight * fit.scaleY).toBeCloseTo(900, 5)
    expect(fit.offsetLeft).toBe(0)
    expect(fit.offsetTop).toBe(0)
  })
})

describe('computeViewportBoardFit contain mode', () => {
  test('uniform scale with letterbox offsets', () => {
    const fit = computeViewportBoardFit({ viewportWidth: 2000, viewportHeight: 1080, mode: 'contain' })
    expect(fit.scaleX).toBeCloseTo(fit.scaleY, 6)
    expect(fit.layoutWidth * fit.scaleX).toBeCloseTo(1920, 4)
    expect(fit.offsetLeft).toBeCloseTo((2000 - 1920) / 2, 4)
    expect(fit.offsetTop).toBe(0)
  })
})

describe('shouldEnableBoardFit', () => {
  test('enables for wide landscape windows', () => {
    expect(shouldEnableBoardFit(1280, 720, { width: 0, height: 0 })).toBe(true)
    expect(shouldEnableBoardFit(960, 540, { width: 0, height: 0 })).toBe(true)
  })

  test('disables for narrow portrait phones', () => {
    expect(shouldEnableBoardFit(390, 844, { width: 0, height: 0 })).toBe(false)
  })

  test('enables when physical screen is TV-sized even if CSS viewport is small', () => {
    expect(shouldEnableBoardFit(800, 600, { width: 1920, height: 1080 })).toBe(true)
  })
})
