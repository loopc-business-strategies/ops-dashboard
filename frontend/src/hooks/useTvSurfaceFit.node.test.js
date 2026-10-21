import { describe, expect, test } from 'vitest'
import { computeTvSurfaceFit, isTvSurfaceCandidate } from './useTvSurfaceFit.js'

describe('isTvSurfaceCandidate', () => {
  test('true for Full HD nearly fullscreen', () => {
    expect(isTvSurfaceCandidate({
      innerWidth: 1920,
      innerHeight: 1080,
      screenWidth: 1920,
      screenHeight: 1080,
    })).toBe(true)
  })

  test('false for windowed laptop', () => {
    expect(isTvSurfaceCandidate({
      innerWidth: 1280,
      innerHeight: 720,
      screenWidth: 1920,
      screenHeight: 1080,
    })).toBe(false)
  })

  test('false for small screens', () => {
    expect(isTvSurfaceCandidate({
      innerWidth: 1366,
      innerHeight: 768,
      screenWidth: 1366,
      screenHeight: 768,
    })).toBe(false)
  })
})

describe('computeTvSurfaceFit', () => {
  test('identity-ish on 1920×1080 with inset', () => {
    const fit = computeTvSurfaceFit({
      viewportWidth: 1920,
      viewportHeight: 1080,
      safeInset: 0.03,
    })
    expect(fit.scale).toBeCloseTo(0.97, 3)
    expect(fit.offsetLeft).toBeGreaterThan(0)
    expect(fit.offsetTop).toBeGreaterThan(0)
  })

  test('uniform scale on 4K', () => {
    const fit = computeTvSurfaceFit({
      viewportWidth: 3840,
      viewportHeight: 2160,
      safeInset: 0,
    })
    expect(fit.scale).toBe(2)
  })
})
