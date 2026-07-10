import { describe, expect, test, vi } from 'vitest'
import { buildBrandingLogoTag } from './erpPrintHelpers'

const createLogoRenderAsset = vi.fn(async () => 'data:image/png;base64,rasterized')

vi.mock('./ERPBrandingUtils', () => ({
  DEFAULT_BRANDING: { logoWidth: 120, logoHeight: 90 },
  clampBrandingDimension: (_value, fallback) => fallback ?? 120,
  createLogoRenderAsset: (...args) => createLogoRenderAsset(...args),
}))

describe('erpPrintHelpers', () => {
  test('buildBrandingLogoTag rasterizes logo at 2x for print', async () => {
    createLogoRenderAsset.mockClear()
    await buildBrandingLogoTag({
      logoUrl: 'data:image/png;base64,logo',
      logoWidth: 180,
      logoHeight: 56,
      logoFit: 'contain',
    })
    expect(createLogoRenderAsset).toHaveBeenCalledWith(
      'data:image/png;base64,logo',
      180,
      56,
      'contain',
      { renderScale: 2 },
    )
  })
})
