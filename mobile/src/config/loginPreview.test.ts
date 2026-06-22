import { describe, expect, it } from 'vitest'
import { getLoginPreviewBranding } from './tenantBranding'

describe('getLoginPreviewBranding', () => {
  it('returns null for empty or invalid company code', () => {
    expect(getLoginPreviewBranding('')).toBeNull()
    expect(getLoginPreviewBranding('   ')).toBeNull()
    expect(getLoginPreviewBranding('xyz')).toBeNull()
    expect(getLoginPreviewBranding('m')).toBeNull()
  })

  it('returns MG branding for mg', () => {
    const branding = getLoginPreviewBranding('mg')
    expect(branding?.logoText).toBe('MG')
    expect(branding?.colors.primary).toBe('#005B96')
    expect(branding?.tagline).toBe('Metal Group Operations')
  })

  it('returns CG branding for cg (case-insensitive)', () => {
    const branding = getLoginPreviewBranding('CG')
    expect(branding?.logoText).toBe('CG')
    expect(branding?.colors.primary).toBe('#9A3412')
    expect(branding?.tagline).toBe('CG Enterprise Suite')
  })

  it('returns LoopC branding for loopc', () => {
    const branding = getLoginPreviewBranding('loopc')
    expect(branding?.logoText).toBe('LC')
    expect(branding?.colors.primary).toBe('#00684A')
    expect(branding?.tagline).toBe('Loop C Business Platform')
  })
})
