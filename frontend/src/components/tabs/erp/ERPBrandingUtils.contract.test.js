/**
 * Contract tests for ERPBrandingUtils.js
 * Verifies the exported constants and pure functions stay stable.
 */

import {
  DEFAULT_BRANDING,
  DEFAULT_BRANDING_PROFILES,
  LOGO_UPLOAD_ACCEPT,
  LOGO_UPLOAD_MAX_BYTES,
  normalizeBrandingKey,
  clampBrandingDimension,
  brandingOptionLabel,
  createLogoRenderAsset,
  isSupportedLogoUpload,
} from './ERPBrandingUtils'

describe('ERPBrandingUtils – DEFAULT_BRANDING', () => {
  test('has required shape with sensible defaults', () => {
    expect(DEFAULT_BRANDING.key).toBe('default')
    expect(DEFAULT_BRANDING.isDefault).toBe(true)
    expect(typeof DEFAULT_BRANDING.logoWidth).toBe('number')
    expect(typeof DEFAULT_BRANDING.logoHeight).toBe('number')
    expect(DEFAULT_BRANDING.logoWidth).toBeGreaterThan(0)
    expect(DEFAULT_BRANDING.logoHeight).toBeGreaterThan(0)
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
    const origDocument = global.document
    // eslint-disable-next-line no-global-assign
    Object.defineProperty(global, 'document', { value: undefined, configurable: true, writable: true })
    const result = await createLogoRenderAsset('http://example.com/logo.png', 180, 56)
    expect(result).toBe('')
    Object.defineProperty(global, 'document', { value: origDocument, configurable: true, writable: true })
  })
})

describe('ERPBrandingUtils – logo uploads', () => {
  test('accept string explicitly includes PNG and SVG', () => {
    expect(LOGO_UPLOAD_ACCEPT).toContain('image/png')
    expect(LOGO_UPLOAD_ACCEPT).toContain('image/svg+xml')
    expect(LOGO_UPLOAD_ACCEPT).toContain('.png')
    expect(LOGO_UPLOAD_ACCEPT).toContain('.svg')
  })

  test('supports PNG and SVG logo files only', () => {
    expect(isSupportedLogoUpload({ name: 'logo.png', type: 'image/png' })).toBe(true)
    expect(isSupportedLogoUpload({ name: 'logo.svg', type: 'image/svg+xml' })).toBe(true)
    expect(isSupportedLogoUpload({ name: 'logo.SVG', type: '' })).toBe(true)
    expect(isSupportedLogoUpload({ name: 'logo.jpg', type: 'image/jpeg' })).toBe(false)
  })

  test('allows logo uploads up to 3 MB', () => {
    expect(LOGO_UPLOAD_MAX_BYTES).toBe(3 * 1024 * 1024)
  })
})
