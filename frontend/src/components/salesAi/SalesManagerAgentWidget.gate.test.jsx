import { describe, expect, test } from 'vitest'
import { getTenantBranding } from '../../config/tenantBranding'
import { shouldShowSalesManagerAi } from './salesAiGate'

describe('Sales Manager AI tenant gate (legacy widget)', () => {
  test('does not show for MG branding', () => {
    const mg = getTenantBranding('mg')
    expect(shouldShowSalesManagerAi({ token: 'session-token', branding: mg })).toBe(false)
  })

  test('does not show for LoopC without auth token', () => {
    const loopc = getTenantBranding('loopc')
    expect(shouldShowSalesManagerAi({ token: '', branding: loopc })).toBe(false)
  })

  test('does not show in-dashboard widget after split (external app only)', () => {
    const loopc = getTenantBranding('loopc')
    expect(shouldShowSalesManagerAi({ token: 'session-token', branding: loopc })).toBe(false)
    expect(loopc.externalNavItems?.some((i) => i.id === 'sales-manager-ai')).toBe(true)
  })
})
