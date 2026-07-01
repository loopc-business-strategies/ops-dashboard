import { describe, expect, test } from 'vitest'
import { getTenantBranding } from '../../config/tenantBranding'
import { shouldShowSalesManagerAi } from './salesAiGate'

describe('Sales Manager AI tenant gate', () => {
  test('does not show for MG branding even with flag', () => {
    const mg = getTenantBranding('mg')
    expect(shouldShowSalesManagerAi({ token: 'session-token', branding: mg })).toBe(false)
  })

  test('does not show for LoopC without auth token', () => {
    const loopc = getTenantBranding('loopc')
    expect(loopc.featureFlags.salesManagerAi).toBe(true)
    expect(shouldShowSalesManagerAi({ token: '', branding: loopc })).toBe(false)
  })

  test('shows for LoopC with token and feature flag', () => {
    const loopc = getTenantBranding('loopc')
    expect(shouldShowSalesManagerAi({ token: 'session-token', branding: loopc })).toBe(true)
  })
})
