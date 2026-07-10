/**
 * ERP report branding utilities.
 * Pure helpers — no React, no API calls, no side effects.
 */

import { sanitizeLogoUrl } from '../../../utils/safeHtml'

export const DEFAULT_SIGNATORIES = [
  { title: "RECEIVER'S SIGNATURE", name: '', visible: true },
  { title: 'CHECKED BY', name: '', visible: true },
  { title: 'AUTHORISED SIGNATORY', name: '', visible: true },
]

export const DEFAULT_STATEMENT_SIGNATORIES = [
  { title: 'Prepared By', name: '', visible: true },
  { title: 'Reviewed By', name: '', visible: true },
  { title: 'Authorized Signatory', name: '', visible: true },
]

export const DEFAULT_TITLE_ACCENT_COLOR = '#7F1D1D'
export const DEFAULT_HEADER_DIVIDER_COLOR = '#111827'

export const DEFAULT_VOUCHER_PRINT = {
  logoOffsetX: 0,
  logoOffsetY: 0,
  logoTransparent: true,
  titleAccentColor: DEFAULT_TITLE_ACCENT_COLOR,
  headerDividerColor: DEFAULT_HEADER_DIVIDER_COLOR,
  tableHeaders: {
    no: 'No.',
    description: 'Account Description',
    type: 'Type',
    amountFc: 'Amount FC',
    amountLc: 'Amount',
  },
  signatories: DEFAULT_SIGNATORIES,
  confirmedForLabel: 'Confirmed for & on behalf of',
  footerNote: '',
  companyNameFontSize: 15,
  addressFontSize: 9,
}

const HEX_COLOR_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/

/**
 * Coerce a color string to a safe 6-digit hex (or default).
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {string}
 */
export const normalizeHexColor = (value, fallback) => {
  const raw = String(value ?? '').trim()
  if (!HEX_COLOR_RE.test(raw)) return fallback
  if (raw.length === 4) {
    const [, r, g, b] = raw
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  return raw.toUpperCase()
}

export const normalizeTitleAccentColor = (value, fallback = DEFAULT_TITLE_ACCENT_COLOR) => (
  normalizeHexColor(value, fallback)
)

export const normalizeHeaderDividerColor = (value, fallback = DEFAULT_HEADER_DIVIDER_COLOR) => (
  normalizeHexColor(value, fallback)
)

export const STATEMENT_COMPANY_NAME_FONT_MIN = 10
export const STATEMENT_COMPANY_NAME_FONT_MAX = 28
export const STATEMENT_ADDRESS_FONT_MIN = 8
export const STATEMENT_ADDRESS_FONT_MAX = 16

export const DEFAULT_STATEMENT_PRINT = {
  logoOffsetX: 0,
  logoOffsetY: 0,
  logoTransparent: true,
  title: 'Statement of Account',
  subtitle: '',
  footerNote: '',
  signatories: DEFAULT_STATEMENT_SIGNATORIES,
  showPrintNote: true,
  companyNameFontSize: 15,
  addressFontSize: 10,
}

export const DEFAULT_BRANDING = {
  key: 'default',
  entityName: 'Main Entity',
  branchName: '',
  isDefault: true,
  companyName: 'Ops Dashboard ERP',
  legalName: '',
  address: '',
  phone: '',
  trn: '',
  reportSubtitle: 'Finance & Accounts Division',
  logoUrl: '',
  logoWidth: 180,
  logoHeight: 56,
  logoFit: 'contain',
  reportFooter: 'Confidential Internal Statement',
  preparedByTitle: 'Prepared By',
  preparedByName: 'Finance Officer',
  reviewedByTitle: 'Reviewed By',
  reviewedByName: 'Accounts Manager',
  approvedByTitle: 'Authorized Signatory',
  approvedByName: 'Finance Controller',
  voucherPrint: DEFAULT_VOUCHER_PRINT,
  statementPrint: DEFAULT_STATEMENT_PRINT,
}

export const DEFAULT_BRANDING_PROFILES = [{
  key: DEFAULT_BRANDING.key,
  entityName: DEFAULT_BRANDING.entityName,
  branchName: DEFAULT_BRANDING.branchName,
  companyName: DEFAULT_BRANDING.companyName,
  isDefault: DEFAULT_BRANDING.isDefault,
}]

export const LOGO_UPLOAD_ACCEPT = 'image/png,image/svg+xml,image/jpeg,image/webp,.png,.svg,.jpg,.jpeg,.webp'
export const LOGO_UPLOAD_MAX_BYTES = 3 * 1024 * 1024
export const LOGO_UPLOAD_MAX_DIMENSION = 1024
export const SUPPORTED_LOGO_MIME_TYPES = new Set(['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'])
export const SUPPORTED_LOGO_EXTENSIONS = new Set(['png', 'svg', 'jpg', 'jpeg', 'webp'])

export const isSupportedLogoUpload = (file = {}) => {
  const type = String(file?.type || '').trim().toLowerCase()
  const extension = String(file?.name || '').split('.').pop()?.trim().toLowerCase()
  return SUPPORTED_LOGO_MIME_TYPES.has(type) || SUPPORTED_LOGO_EXTENSIONS.has(extension)
}

const clampOffset = (value, fallback = 0) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, -120), 120)
}

const normalizeSignatories = (items, fallback) => {
  const source = Array.isArray(items) ? items : fallback
  return fallback.map((defaultItem, index) => {
    const item = source[index] || {}
    return {
      title: String(item.title ?? defaultItem.title).trim() || defaultItem.title,
      name: String(item.name ?? '').trim(),
      visible: item.visible !== false,
    }
  })
}

export const normalizeVoucherPrint = (value = {}) => ({
  ...DEFAULT_VOUCHER_PRINT,
  ...(value || {}),
  logoOffsetX: clampOffset(value.logoOffsetX, DEFAULT_VOUCHER_PRINT.logoOffsetX),
  logoOffsetY: clampOffset(value.logoOffsetY, DEFAULT_VOUCHER_PRINT.logoOffsetY),
  logoTransparent: value.logoTransparent !== false,
  titleAccentColor: normalizeTitleAccentColor(value.titleAccentColor, DEFAULT_VOUCHER_PRINT.titleAccentColor),
  headerDividerColor: normalizeHeaderDividerColor(value.headerDividerColor, DEFAULT_VOUCHER_PRINT.headerDividerColor),
  tableHeaders: {
    ...DEFAULT_VOUCHER_PRINT.tableHeaders,
    ...(value.tableHeaders || {}),
  },
  signatories: normalizeSignatories(value.signatories, DEFAULT_SIGNATORIES),
  confirmedForLabel: String(value.confirmedForLabel ?? DEFAULT_VOUCHER_PRINT.confirmedForLabel).trim() || DEFAULT_VOUCHER_PRINT.confirmedForLabel,
  footerNote: String(value.footerNote ?? '').trim(),
  companyNameFontSize: clampStatementFontSize(
    value.companyNameFontSize,
    DEFAULT_VOUCHER_PRINT.companyNameFontSize,
    STATEMENT_COMPANY_NAME_FONT_MIN,
    STATEMENT_COMPANY_NAME_FONT_MAX,
  ),
  addressFontSize: clampStatementFontSize(
    value.addressFontSize,
    DEFAULT_VOUCHER_PRINT.addressFontSize,
    STATEMENT_ADDRESS_FONT_MIN,
    STATEMENT_ADDRESS_FONT_MAX,
  ),
})

export const clampStatementFontSize = (value, fallback, min, max) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

export const normalizeStatementPrint = (value = {}) => ({
  ...DEFAULT_STATEMENT_PRINT,
  ...(value || {}),
  logoOffsetX: clampOffset(value.logoOffsetX, DEFAULT_STATEMENT_PRINT.logoOffsetX),
  logoOffsetY: clampOffset(value.logoOffsetY, DEFAULT_STATEMENT_PRINT.logoOffsetY),
  logoTransparent: value.logoTransparent !== false,
  title: String(value.title ?? DEFAULT_STATEMENT_PRINT.title).trim() || DEFAULT_STATEMENT_PRINT.title,
  subtitle: String(value.subtitle ?? '').trim(),
  footerNote: String(value.footerNote ?? '').trim(),
  signatories: normalizeSignatories(value.signatories, DEFAULT_STATEMENT_SIGNATORIES),
  showPrintNote: value.showPrintNote !== false,
  companyNameFontSize: clampStatementFontSize(
    value.companyNameFontSize,
    DEFAULT_STATEMENT_PRINT.companyNameFontSize,
    STATEMENT_COMPANY_NAME_FONT_MIN,
    STATEMENT_COMPANY_NAME_FONT_MAX,
  ),
  addressFontSize: clampStatementFontSize(
    value.addressFontSize,
    DEFAULT_STATEMENT_PRINT.addressFontSize,
    STATEMENT_ADDRESS_FONT_MIN,
    STATEMENT_ADDRESS_FONT_MAX,
  ),
})

/**
 * Normalises an arbitrary string into a safe branding key.
 * @param {string} value
 * @returns {string}
 */
export const normalizeBrandingKey = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'default'
}

/**
 * Clamps a numeric branding dimension (logo width/height) within [min, max].
 * Falls back to `fallback` when value is not a finite number.
 * @param {*} value
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export const clampBrandingDimension = (value, fallback, min, max) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

/**
 * Human-readable label for a branding profile option.
 * @param {{ entityName?: string, branchName?: string, companyName?: string }} branding
 * @returns {string}
 */
export const brandingOptionLabel = (branding) => {
  const entity = branding.entityName || DEFAULT_BRANDING.entityName
  const branch = branding.branchName ? ` / ${branding.branchName}` : ''
  const company = branding.companyName ? ` - ${branding.companyName}` : ''
  return `${entity}${branch}${company}`
}

/**
 * Converts an uploaded image file to a PNG data URL (preserves alpha when possible).
 * @param {File} file
 * @returns {Promise<string>}
 */
const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('Failed to read logo file'))
  reader.readAsDataURL(file)
})

const removeNearWhiteBackground = (ctx, width, height) => {
  try {
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    for (let index = 0; index < data.length; index += 4) {
      const red = data[index]
      const green = data[index + 1]
      const blue = data[index + 2]
      const alpha = data[index + 3]
      const max = Math.max(red, green, blue)
      const min = Math.min(red, green, blue)
      // Remove mostly neutral light background while preserving saturated logo colors.
      if (alpha > 0 && red >= 220 && green >= 220 && blue >= 220 && (max - min) <= 18) {
        data[index + 3] = 0
      }
    }
    ctx.putImageData(imageData, 0, 0)
  } catch {
    // Keep original image if pixel extraction is blocked or unavailable.
  }
}

const processLogoWithBackgroundCleanup = async (logoUrl, maxDimension = LOGO_UPLOAD_MAX_DIMENSION) => {
  const safeUrl = sanitizeLogoUrl(logoUrl)
  if (!safeUrl || typeof document === 'undefined') return ''

  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      try {
        let width = image.naturalWidth || image.width
        let height = image.naturalHeight || image.height
        const maxSide = Math.max(width, height)
        if (maxSide > maxDimension) {
          const ratio = maxDimension / maxSide
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve('')
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(image, 0, 0, width, height)
        removeNearWhiteBackground(ctx, width, height)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve('')
      }
    }
    image.onerror = () => resolve('')
    image.src = safeUrl
  })
}

export const normalizeLogoDataUrl = async (logoUrl, options = {}) => {
  const {
    removeBackground = false,
    maxDimension = LOGO_UPLOAD_MAX_DIMENSION,
  } = options

  if (removeBackground) {
    const cleaned = await processLogoWithBackgroundCleanup(logoUrl, maxDimension)
    return cleaned || logoUrl
  }

  return logoUrl
}

export const normalizeLogoUploadToDataUrl = async (file, options = {}) => {
  if (!file || typeof document === 'undefined') {
    throw new Error('Failed to process logo file.')
  }

  const type = String(file.type || '').toLowerCase()
  const dataUrl = await readFileAsDataUrl(file)
  if (!dataUrl) {
    throw new Error('Failed to process logo file.')
  }

  if (type === 'image/svg+xml') {
    return dataUrl
  }

  if (options.removeBackground === true) {
    const result = await processLogoWithBackgroundCleanup(
      dataUrl,
      options.maxDimension ?? LOGO_UPLOAD_MAX_DIMENSION,
    )
    if (!result) {
      throw new Error('Failed to process logo file.')
    }
    return result
  }

  return dataUrl
}

/**
 * Renders a logo URL onto an off-screen canvas and returns a base64 PNG data URL.
 * Returns the original URL on error, or an empty string when no URL is provided.
 * @param {string} logoUrl
 * @param {number} width
 * @param {number} height
 * @param {'contain'|'cover'|'fill'} fit
 * @returns {Promise<string>}
 */
export const createLogoRenderAsset = async (logoUrl, width, height, fit = 'contain', options = {}) => {
  const safeUrl = sanitizeLogoUrl(logoUrl)
  if (!safeUrl || typeof document === 'undefined') return ''
  const removeBackground = options?.removeBackground === true
  const renderScale = Math.min(Math.max(Number(options?.renderScale) || 1, 1), 3)

  const boxWidth = clampBrandingDimension(width, DEFAULT_BRANDING.logoWidth, 80, 260)
  const boxHeight = clampBrandingDimension(height, DEFAULT_BRANDING.logoHeight, 32, 120)
  const canvasWidth = Math.round(boxWidth * renderScale)
  const canvasHeight = Math.round(boxHeight * renderScale)

  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = canvasWidth
        canvas.height = canvasHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve('')
        ctx.clearRect(0, 0, canvasWidth, canvasHeight)

        if (fit === 'fill') {
          ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight)
        } else {
          const scale = fit === 'cover'
            ? Math.max(canvasWidth / image.width, canvasHeight / image.height)
            : Math.min(canvasWidth / image.width, canvasHeight / image.height)
          const drawWidth = image.width * scale
          const drawHeight = image.height * scale
          const dx = (canvasWidth - drawWidth) / 2
          const dy = (canvasHeight - drawHeight) / 2
          ctx.drawImage(image, dx, dy, drawWidth, drawHeight)
        }
        if (removeBackground) {
          removeNearWhiteBackground(ctx, canvasWidth, canvasHeight)
        }

        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve('')
      }
    }
    image.onerror = () => resolve('')
    image.src = safeUrl
  })
}
