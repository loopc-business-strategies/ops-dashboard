import { describe, expect, test } from 'vitest'
import { resolveDocumentBranding } from './documentBranding'

describe('resolveDocumentBranding', () => {
  test('does not use tenant default logo for document printouts', () => {
    const branding = resolveDocumentBranding({
      reportBranding: {},
      tenantBranding: {
        displayName: 'MG',
        companyName: 'Modern Gold',
        logoImage: '/logos/mg-logo.svg',
      },
    })

    expect(branding.logoUrl).toBe('')
  })

  test('uses uploaded logo from logo settings when present', () => {
    const branding = resolveDocumentBranding({
      reportBranding: {
        logoUrl: 'data:image/png;base64,uploaded',
      },
      tenantBranding: {
        logoImage: '/logos/mg-logo.svg',
      },
    })

    expect(branding.logoUrl).toBe('data:image/png;base64,uploaded')
  })
})
