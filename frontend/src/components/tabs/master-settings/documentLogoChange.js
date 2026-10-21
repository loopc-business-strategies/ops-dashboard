import { clampBrandingDimension, DEFAULT_BRANDING } from '../erp/ERPBrandingUtils'

export const LOGO_SIZE_MIN_PERCENT = 50
export const LOGO_SIZE_MAX_PERCENT = 200
export const LOGO_SIZE_BASELINE_WIDTH = DEFAULT_BRANDING.logoWidth
export const LOGO_SIZE_BASELINE_HEIGHT = DEFAULT_BRANDING.logoHeight
export const VOUCHER_LOGO_FRAME_WIDTH = 260
export const VOUCHER_LOGO_FRAME_HEIGHT = 140
const MIN_LOGO_WIDTH = 80
const MAX_LOGO_WIDTH = 260
const MIN_LOGO_HEIGHT = 32
const MAX_LOGO_HEIGHT = 140
/** Slight print boost so voucher headers read a bit larger than the settings preview box. */
const VOUCHER_PRINT_SIZE_BOOST = 1.05
/** Default voucher logo box when branding still uses the short report baseline. */
const VOUCHER_PRINT_FALLBACK_WIDTH = 190
const VOUCHER_PRINT_FALLBACK_HEIGHT = 126

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
    logoWidth: clampBrandingDimension(LOGO_SIZE_BASELINE_WIDTH * scale, LOGO_SIZE_BASELINE_WIDTH, 80, MAX_LOGO_WIDTH),
    logoHeight: clampBrandingDimension(LOGO_SIZE_BASELINE_HEIGHT * scale, LOGO_SIZE_BASELINE_HEIGHT, 32, MAX_LOGO_HEIGHT),
  }
}

/**
 * Voucher print/preview size: branding dims with a small boost, clamped to the voucher frame.
 * Short report baselines (e.g. 180×56) underfill voucher headers — use the full frame instead.
 * @param {{ logoWidth?: number, logoHeight?: number }} branding
 * @returns {{ logoWidth: number, logoHeight: number }}
 */
export function resolveVoucherPrintLogoSize(branding = {}) {
  const width = Number(branding?.logoWidth)
  const height = Number(branding?.logoHeight)
  const hasWidth = Number.isFinite(width) && width > 0
  const hasHeight = Number.isFinite(height) && height > 0

  // Legacy / report baseline is intentionally short; voucher headers need a taller frame.
  if (!hasWidth || !hasHeight || height <= LOGO_SIZE_BASELINE_HEIGHT + 4) {
    return {
      logoWidth: VOUCHER_PRINT_FALLBACK_WIDTH,
      logoHeight: VOUCHER_PRINT_FALLBACK_HEIGHT,
    }
  }

  return {
    logoWidth: clampBrandingDimension(
      Math.round(width * VOUCHER_PRINT_SIZE_BOOST),
      LOGO_SIZE_BASELINE_WIDTH,
      MIN_LOGO_WIDTH,
      MAX_LOGO_WIDTH,
    ),
    logoHeight: clampBrandingDimension(
      Math.round(height * VOUCHER_PRINT_SIZE_BOOST),
      LOGO_SIZE_BASELINE_HEIGHT,
      MIN_LOGO_HEIGHT,
      MAX_LOGO_HEIGHT,
    ),
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
