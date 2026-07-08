/**
 * Contract tests for ERPBrandingUtils.js
 * Verifies the exported constants and pure functions stay stable.
 */

import { describe, expect, test, vi, afterEach } from 'vitest'
import * as ERPBrandingUtils from './ERPBrandingUtils'

const {
  DEFAULT_BRANDING,
  DEFAULT_BRANDING_PROFILES,
  DEFAULT_TITLE_ACCENT_COLOR,
  DEFAULT_VOUCHER_PRINT,
  LOGO_UPLOAD_ACCEPT,
  LOGO_UPLOAD_MAX_BYTES,
  normalizeBrandingKey,
  clampBrandingDimension,
  brandingOptionLabel,
  createLogoRenderAsset,
  isSupportedLogoUpload,
  normalizeLogoDataUrl,
  normalizeLogoUploadToDataUrl,
  normalizeTitleAccentColor,
  normalizeVoucherPrint,
} = ERPBrandingUtils

describe('ERPBrandingUtils – DEFAULT_BRANDING', () => {
  test('has required shape with sensible defaults', () => {
    expect(DEFAULT_BRANDING.key).toBe('default')
    expect(DEFAULT_BRANDING.isDefault).toBe(true)
    expect(typeof DEFAULT_BRANDING.logoWidth).toBe('number')
    expect(typeof DEFAULT_BRANDING.logoHeight).toBe('number')
    expect(DEFAULT_BRANDING.logoWidth).toBeGreaterThan(0)
    expect(DEFAULT_BRANDING.logoHeight).toBeGreaterThan(0)
    expect(DEFAULT_VOUCHER_PRINT.titleAccentColor).toBe(DEFAULT_TITLE_ACCENT_COLOR)
    expect(DEFAULT_TITLE_ACCENT_COLOR).toBe('#7F1D1D')
  })

  test('normalizeTitleAccentColor and normalizeVoucherPrint handle accent color', () => {
    expect(normalizeTitleAccentColor('#005b96')).toBe('#005B96')
    expect(normalizeTitleAccentColor('#abc')).toBe('#AABBCC')
    expect(normalizeTitleAccentColor('not-a-color')).toBe('#7F1D1D')
    expect(normalizeVoucherPrint({ titleAccentColor: '#123456' }).titleAccentColor).toBe('#123456')
    expect(normalizeVoucherPrint({ titleAccentColor: '' }).titleAccentColor).toBe('#7F1D1D')
  })

  test('DEFAULT_BRANDING_PROFILES contains one entry mirroring DEFAULT_BRANDING', () => {
    expect(DEFAULT_BRANDING_PROFILES).toHaveLength(1)
    const [profile] = DEFAULT_BRANDING_PROFILES
    expect(profile.key).toBe(DEFAULT_BRANDING.key)
    expect(profile.entityName).toBe(DEFAULT_BRANDING.entityName)
    expect(profile.isDefault).toBe(true)
  })
})

describe('ERPBrandingUtils – normalizeBrandingKey', () => {
  test('lowercases and replaces non-alphanumeric with hyphens', () => {
    expect(normalizeBrandingKey('Main Entity')).toBe('main-entity')
    expect(normalizeBrandingKey('ABC--DEF')).toBe('abc-def')
  })

  test('strips leading and trailing hyphens', () => {
    expect(normalizeBrandingKey('--hello--')).toBe('hello')
  })

  test('returns "default" for empty or falsy input', () => {
    expect(normalizeBrandingKey('')).toBe('default')
    expect(normalizeBrandingKey(null)).toBe('default')
    expect(normalizeBrandingKey(undefined)).toBe('default')
  })
})

describe('ERPBrandingUtils – clampBrandingDimension', () => {
  test('clamps value within [min, max]', () => {
    expect(clampBrandingDimension(50, 180, 80, 260)).toBe(80)   // below min
    expect(clampBrandingDimension(300, 180, 80, 260)).toBe(260)  // above max
    expect(clampBrandingDimension(150, 180, 80, 260)).toBe(150)  // in range
  })

  test('returns fallback for non-finite values', () => {
    expect(clampBrandingDimension(NaN, 180, 80, 260)).toBe(180)
    expect(clampBrandingDimension(undefined, 56, 32, 120)).toBe(56)
    expect(clampBrandingDimension('text', 56, 32, 120)).toBe(56)
  })
})

describe('ERPBrandingUtils – brandingOptionLabel', () => {
  test('uses entityName, branchName, and companyName', () => {
    const label = brandingOptionLabel({
      entityName: 'Head Office',
      branchName: 'Dubai',
      companyName: 'Acme Corp',
    })
    expect(label).toBe('Head Office / Dubai - Acme Corp')
  })

  test('omits branch when branchName is empty', () => {
    const label = brandingOptionLabel({
      entityName: 'Head Office',
      branchName: '',
      companyName: 'Acme Corp',
    })
    expect(label).toBe('Head Office - Acme Corp')
  })

  test('falls back to DEFAULT_BRANDING.entityName when entityName is missing', () => {
    const label = brandingOptionLabel({ branchName: '', companyName: '' })
    expect(label).toContain(DEFAULT_BRANDING.entityName)
  })
})

describe('ERPBrandingUtils – createLogoRenderAsset', () => {
  test('returns empty string when logoUrl is empty', async () => {
    const result = await createLogoRenderAsset('', 180, 56)
    expect(result).toBe('')
  })

  test('returns empty string when document is undefined (SSR/test env)', async () => {
    // jsdom defines document, so temporarily undefine it
    const origDocument = globalThis.document

    Object.defineProperty(globalThis, 'document', { value: undefined, configurable: true, writable: true })
    const result = await createLogoRenderAsset('http://example.com/logo.png', 180, 56)
    expect(result).toBe('')
    Object.defineProperty(globalThis, 'document', { value: origDocument, configurable: true, writable: true })
  })
})

describe('ERPBrandingUtils – logo uploads', () => {
  test('accept string explicitly includes PNG, SVG, JPEG, and WebP', () => {
    expect(LOGO_UPLOAD_ACCEPT).toContain('image/png')
    expect(LOGO_UPLOAD_ACCEPT).toContain('image/svg+xml')
    expect(LOGO_UPLOAD_ACCEPT).toContain('image/jpeg')
    expect(LOGO_UPLOAD_ACCEPT).toContain('image/webp')
    expect(LOGO_UPLOAD_ACCEPT).toContain('.png')
    expect(LOGO_UPLOAD_ACCEPT).toContain('.svg')
  })

  test('supports PNG, SVG, JPEG, and WebP logo files', () => {
    expect(isSupportedLogoUpload({ name: 'logo.png', type: 'image/png' })).toBe(true)
    expect(isSupportedLogoUpload({ name: 'logo.svg', type: 'image/svg+xml' })).toBe(true)
    expect(isSupportedLogoUpload({ name: 'logo.SVG', type: '' })).toBe(true)
    expect(isSupportedLogoUpload({ name: 'logo.jpg', type: 'image/jpeg' })).toBe(true)
    expect(isSupportedLogoUpload({ name: 'logo.webp', type: 'image/webp' })).toBe(true)
    expect(isSupportedLogoUpload({ name: 'logo.gif', type: 'image/gif' })).toBe(false)
  })

  test('allows logo uploads up to 3 MB', () => {
    expect(LOGO_UPLOAD_MAX_BYTES).toBe(3 * 1024 * 1024)
  })
})

describe('ERPBrandingUtils – normalizeLogoUploadToDataUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  test('returns SVG data URL without raster normalization', async () => {
    class MockFileReader {
      readAsDataURL() {
        this.result = 'data:image/svg+xml;base64,abc'
        this.onload?.()
      }
    }
    vi.stubGlobal('FileReader', MockFileReader)

    const result = await normalizeLogoUploadToDataUrl({
      type: 'image/svg+xml',
      name: 'logo.svg',
    })
    expect(result).toBe('data:image/svg+xml;base64,abc')
  })

  test('normalizes raster uploads to PNG data URL', async () => {
    class MockFileReader {
      readAsDataURL() {
        this.result = 'data:image/png;base64,raw'
        this.onload?.()
      }
    }
    vi.stubGlobal('FileReader', MockFileReader)

    class MockImage {
      constructor() {
        this.width = 100
        this.height = 50
        this.crossOrigin = ''
      }

      set src(_value) {
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal('Image', MockImage)

    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
      putImageData: vi.fn(),
    })
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/png;base64,normalized')

    const result = await normalizeLogoUploadToDataUrl({
      type: 'image/png',
      name: 'logo.png',
    })

    expect(result).toBe('data:image/png;base64,normalized')
    getContext.mockRestore()
    toDataURL.mockRestore()
  })

  test('applies background cleanup path when requested', async () => {
    class MockFileReader {
      readAsDataURL() {
        this.result = 'data:image/png;base64,raw'
        this.onload?.()
      }
    }
    vi.stubGlobal('FileReader', MockFileReader)

    class MockImage {
      constructor() {
        this.width = 100
        this.height = 50
        this.crossOrigin = ''
      }

      set src(_value) {
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal('Image', MockImage)

    const getImageData = vi.fn(() => ({ data: new Uint8ClampedArray([255, 255, 255, 255]), width: 1, height: 1 }))
    const putImageData = vi.fn()
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData,
      putImageData,
    })
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/png;base64,normalized')

    const result = await normalizeLogoUploadToDataUrl({
      type: 'image/png',
      name: 'logo.png',
    }, {
      removeBackground: true,
    })

    expect(result).toBe('data:image/png;base64,normalized')
    expect(getImageData).toHaveBeenCalled()
    expect(putImageData).toHaveBeenCalled()
    getContext.mockRestore()
    toDataURL.mockRestore()
  })

  test('falls back to raw data URL when raster normalization returns empty', async () => {
    class MockFileReader {
      readAsDataURL() {
        this.result = 'data:image/png;base64,raw'
        this.onload?.()
      }
    }
    vi.stubGlobal('FileReader', MockFileReader)

    class MockImage {
      constructor() {
        this.width = 100
        this.height = 50
        this.crossOrigin = ''
      }

      set src(_value) {
        queueMicrotask(() => this.onerror?.())
      }
    }
    vi.stubGlobal('Image', MockImage)

    const result = await normalizeLogoUploadToDataUrl({
      type: 'image/png',
      name: 'logo.png',
    })

    expect(result).toBe('data:image/png;base64,raw')
  })

  test('throws when file read returns empty result', async () => {
    class MockFileReader {
      readAsDataURL() {
        this.result = ''
        this.onload?.()
      }
    }
    vi.stubGlobal('FileReader', MockFileReader)

    await expect(normalizeLogoUploadToDataUrl({
      type: 'image/png',
      name: 'logo.png',
    })).rejects.toThrow('Failed to process logo file.')
  })
})

describe('ERPBrandingUtils – normalizeLogoDataUrl', () => {
  test('returns original URL when rendering fails', async () => {
    class MockImage {
      set src(_value) {
        queueMicrotask(() => this.onerror?.())
      }
    }
    vi.stubGlobal('Image', MockImage)

    const result = await normalizeLogoDataUrl('data:image/png;base64,raw', {
      removeBackground: true,
      width: 200,
      height: 80,
    })
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
