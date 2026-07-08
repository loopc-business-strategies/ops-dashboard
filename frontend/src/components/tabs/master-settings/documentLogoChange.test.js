import { describe, expect, test, vi } from 'vitest'
import {
  applyDocumentLogoPatch,
  logoSizePercentFromDimensions,
  scaleDocumentLogoSize,
} from './documentLogoChange'

describe('applyDocumentLogoPatch', () => {
  test('applies logoUrl when error is empty string', () => {
    const setLogoError = vi.fn()
    const patchBranding = vi.fn()

    applyDocumentLogoPatch({ logoUrl: 'data:image/png;base64,abc', error: '' }, {
      setLogoError,
      patchBranding,
    })

    expect(setLogoError).toHaveBeenCalledWith('')
    expect(patchBranding).toHaveBeenCalledWith({ logoUrl: 'data:image/png;base64,abc' })
  })

  test('applies logoUrl on success without error key', () => {
    const setLogoError = vi.fn()
    const patchBranding = vi.fn()

    applyDocumentLogoPatch({ logoUrl: 'data:image/svg+xml;base64,xyz' }, {
      setLogoError,
      patchBranding,
    })

    expect(setLogoError).toHaveBeenCalledWith('')
    expect(patchBranding).toHaveBeenCalledWith({ logoUrl: 'data:image/svg+xml;base64,xyz' })
  })

  test('blocks branding update when error message is present', () => {
    const setLogoError = vi.fn()
    const patchBranding = vi.fn()

    applyDocumentLogoPatch({
      logoUrl: 'data:image/png;base64,abc',
      error: 'Logo file is too large. Maximum size is 3 MB.',
    }, {
      setLogoError,
      patchBranding,
    })

    expect(setLogoError).toHaveBeenCalledWith('Logo file is too large. Maximum size is 3 MB.')
    expect(patchBranding).not.toHaveBeenCalled()
  })

  test('clears logo error and removes logo when logoUrl is empty', () => {
    const setLogoError = vi.fn()
    const patchBranding = vi.fn()

    applyDocumentLogoPatch({ logoUrl: '' }, {
      setLogoError,
      patchBranding,
    })

    expect(setLogoError).toHaveBeenCalledWith('')
    expect(patchBranding).toHaveBeenCalledWith({ logoUrl: '' })
  })
})

describe('scaleDocumentLogoSize', () => {
  test('scales default baseline dimensions by percent', () => {
    expect(scaleDocumentLogoSize({}, 100)).toEqual({ logoWidth: 180, logoHeight: 56 })
    expect(scaleDocumentLogoSize({}, 125)).toEqual({ logoWidth: 225, logoHeight: 70 })
    expect(scaleDocumentLogoSize({}, 50)).toEqual({ logoWidth: 90, logoHeight: 32 })
  })

  test('clamps dimensions at min and max limits', () => {
    expect(scaleDocumentLogoSize({}, 200)).toEqual({ logoWidth: 260, logoHeight: 112 })
    expect(scaleDocumentLogoSize({}, 30)).toEqual({ logoWidth: 80, logoHeight: 32 })
  })
})

describe('logoSizePercentFromDimensions', () => {
  test('returns average percent against default baseline', () => {
    expect(logoSizePercentFromDimensions(180, 56)).toBe(100)
    expect(logoSizePercentFromDimensions(225, 70)).toBe(125)
  })

  test('clamps percent to slider range', () => {
    expect(logoSizePercentFromDimensions(260, 120)).toBe(179)
    expect(logoSizePercentFromDimensions(80, 32)).toBe(51)
  })
})
