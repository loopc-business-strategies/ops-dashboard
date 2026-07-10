import { clampBrandingDimension, DEFAULT_BRANDING } from '../erp/ERPBrandingUtils'

export const LOGO_SIZE_MIN_PERCENT = 50
export const LOGO_SIZE_MAX_PERCENT = 200
export const LOGO_SIZE_BASELINE_WIDTH = DEFAULT_BRANDING.logoWidth
export const LOGO_SIZE_BASELINE_HEIGHT = DEFAULT_BRANDING.logoHeight
export const VOUCHER_LOGO_FRAME_WIDTH = 260
export const VOUCHER_LOGO_FRAME_HEIGHT = 120
const MIN_LOGO_WIDTH = 80
const MAX_LOGO_WIDTH = 260
const MIN_LOGO_HEIGHT = 32
const MAX_LOGO_HEIGHT = 120

/**
 * Maximal display size (contain) for a logo inside the voucher header frame.
 * @param {number} naturalWidth
 * @param {number} naturalHeight
 * @returns {{ logoWidth: number, logoHeight: number }}
 */
export function computeVoucherLogoDimensions(naturalWidth, naturalHeight) {
  const naturalW = Number(naturalWidth)
  const naturalH = Number(naturalHeight)
  if (!Number.isFinite(naturalW) || !Number.isFinite(naturalH) || naturalW <= 0 || naturalH <= 0) {
    return {
      logoWidth: LOGO_SIZE_BASELINE_WIDTH,
      logoHeight: LOGO_SIZE_BASELINE_HEIGHT,
    }
  }

  const scale = Math.min(
    VOUCHER_LOGO_FRAME_WIDTH / naturalW,
    VOUCHER_LOGO_FRAME_HEIGHT / naturalH,
    MAX_LOGO_WIDTH / naturalW,
    MAX_LOGO_HEIGHT / naturalH,
  )

  const logoWidth = clampBrandingDimension(
    Math.round(naturalW * scale),
    LOGO_SIZE_BASELINE_WIDTH,
    MIN_LOGO_WIDTH,
    MAX_LOGO_WIDTH,
  )
  const logoHeight = clampBrandingDimension(
    Math.round(naturalH * scale),
    LOGO_SIZE_BASELINE_HEIGHT,
    MIN_LOGO_HEIGHT,
    MAX_LOGO_HEIGHT,
  )

  return { logoWidth, logoHeight }
}

/**
 * @param {string} src
 * @returns {Promise<{ width: number, height: number }>}
 */
export function loadImageNaturalSize(src) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || !String(src || '').trim()) {
      reject(new Error('Failed to load logo dimensions.'))
      return
    }

    const image = new Image()
    image.onload = () => {
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      })
    }
    image.onerror = () => reject(new Error('Failed to load logo dimensions.'))
    image.src = src
  })
}

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
