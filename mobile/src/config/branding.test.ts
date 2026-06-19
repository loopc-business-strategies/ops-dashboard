import { describe, expect, it } from 'vitest'
import { mgBranding } from './branding'

describe('mgBranding', () => {
  it('uses Nexa MG as the mobile app display name', () => {
    expect(mgBranding.appName).toBe('Nexa MG')
  })
})
