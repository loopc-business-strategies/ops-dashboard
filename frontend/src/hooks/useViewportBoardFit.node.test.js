import { describe, expect, test } from 'vitest'
import { computeViewportBoardFit } from './useViewportBoardFit.js'

describe('computeViewportBoardFit', () => {
  test('exact 1920×1080 is identity', () => {
    expect(computeViewportBoardFit({ viewportWidth: 1920, viewportHeight: 1080 })).toEqual({
      scale: 1,
      layoutWidth: 1920,
      layoutHeight: 1080,
    })
  })

  test('4K doubles scale and keeps 1920×1080 layout', () => {
    expect(computeViewportBoardFit({ viewportWidth: 3840, viewportHeight: 2160 })).toEqual({
      scale: 2,
      layoutWidth: 1920,
      layoutHeight: 1080,
    })
  })

  test('short browser chrome on FHD scales down so full board fits', () => {
    const fit = computeViewportBoardFit({ viewportWidth: 1920, viewportHeight: 900 })
    expect(fit.scale).toBeCloseTo(900 / 1080, 5)
    expect(fit.layoutHeight).toBeCloseTo(1080, 5)
    expect(fit.layoutWidth * fit.scale).toBeCloseTo(1920, 5)
    expect(fit.layoutHeight * fit.scale).toBeCloseTo(900, 5)
  })

  test('visual size always equals viewport', () => {
    const cases = [
      [1920, 1080],
      [3840, 2160],
      [1366, 768],
      [3440, 1440],
      [1280, 720],
    ]
    for (const [vw, vh] of cases) {
      const fit = computeViewportBoardFit({ viewportWidth: vw, viewportHeight: vh })
      expect(fit.layoutWidth * fit.scale).toBeCloseTo(vw, 4)
      expect(fit.layoutHeight * fit.scale).toBeCloseTo(vh, 4)
    }
  })
})
