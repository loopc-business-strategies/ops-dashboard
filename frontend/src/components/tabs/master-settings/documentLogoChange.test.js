import { describe, expect, test, vi } from 'vitest'
import { applyDocumentLogoPatch } from './documentLogoChange'

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
