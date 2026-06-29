import { describe, expect, it } from 'vitest'
import { APP_NAME, getTenantBranding } from './branding'

describe('mobile branding', () => {
  it('uses Nexa as the mobile app display name', () => {
    expect(APP_NAME).toBe('Nexa')
    expect(getTenantBranding('mg').appName).toBe('Nexa')
    expect(getTenantBranding('cg').appName).toBe('Nexa')
    expect(getTenantBranding('loopc').appName).toBe('Nexa')
  })

  it('returns tenant-specific branding by company code', () => {
    expect(getTenantBranding('mg').displayName).toBe('MG')
    expect(getTenantBranding('mg').colors.primary).toBe('#005B96')

    expect(getTenantBranding('cg').displayName).toBe('CG')
    expect(getTenantBranding('cg').colors.primary).toBe('#9A3412')

    expect(getTenantBranding('loopc').displayName).toBe('LoopC')
    expect(getTenantBranding('loopc').colors.primary).toBe('#00684A')
  })
})
