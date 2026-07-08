import { clampBrandingDimension, DEFAULT_BRANDING } from '../erp/ERPBrandingUtils'

export const LOGO_SIZE_MIN_PERCENT = 50
export const LOGO_SIZE_MAX_PERCENT = 200
export const LOGO_SIZE_BASELINE_WIDTH = DEFAULT_BRANDING.logoWidth
export const LOGO_SIZE_BASELINE_HEIGHT = DEFAULT_BRANDING.logoHeight

export function scaleDocumentLogoSize(_dimensions = {}, scalePercent) {
  const scale = Number(scalePercent) / 100
  if (!Number.isFinite(scale) || scale <= 0) {
    return {
      logoWidth: LOGO_SIZE_BASELINE_WIDTH,
      logoHeight: LOGO_SIZE_BASELINE_HEIGHT,
    }
  }

  return {
    logoWidth: clampBrandingDimension(LOGO_SIZE_BASELINE_WIDTH * scale, LOGO_SIZE_BASELINE_WIDTH, 80, 260),
    logoHeight: clampBrandingDimension(LOGO_SIZE_BASELINE_HEIGHT * scale, LOGO_SIZE_BASELINE_HEIGHT, 32, 120),
  }
}

export function logoSizePercentFromDimensions(logoWidth, logoHeight) {
  const width = Number(logoWidth) || LOGO_SIZE_BASELINE_WIDTH
  const height = Number(logoHeight) || LOGO_SIZE_BASELINE_HEIGHT
  const widthPercent = (width / LOGO_SIZE_BASELINE_WIDTH) * 100
  const heightPercent = (height / LOGO_SIZE_BASELINE_HEIGHT) * 100
  const average = Math.round((widthPercent + heightPercent) / 2)
  return Math.min(Math.max(average, LOGO_SIZE_MIN_PERCENT), LOGO_SIZE_MAX_PERCENT)
}

export function applyDocumentLogoPatch(patch, { setLogoError, patchBranding }) {
  if (String(patch.error || '').trim()) {
    setLogoError?.(patch.error)
    return
  }
  setLogoError?.('')
  const { error: _ignored, ...brandingPatch } = patch
  if (Object.keys(brandingPatch).length) {
    patchBranding(brandingPatch)
  }
}
