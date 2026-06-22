import { describe, expect, it } from 'vitest'
import { APP_NAME, getTenantBranding, mgBranding } from './branding'

describe('mobile branding', () => {
  it('uses Nexa as the mobile app display name', () => {
    expect(APP_NAME).toBe('Nexa')
    expect(mgBranding.appName).toBe('Nexa')
  })

  it('returns tenant-specific branding by company code', () => {
    expect(getTenantBranding('cg').displayName).toBe('CG')
    expect(getTenantBranding('loopc').displayName).toBe('LoopC')
  })
})
