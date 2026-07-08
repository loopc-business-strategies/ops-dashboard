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

export const DEFAULT_VOUCHER_PRINT = {
  logoOffsetX: 0,
  logoOffsetY: 0,
  logoTransparent: true,
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
}

export const DEFAULT_STATEMENT_PRINT = {
  logoOffsetX: 0,
  logoOffsetY: 0,
  logoTransparent: true,
  title: 'Statement of Account',
  subtitle: '',
  footerNote: '',
  signatories: DEFAULT_STATEMENT_SIGNATORIES,
  showPrintNote: true,
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
  tableHeaders: {
    ...DEFAULT_VOUCHER_PRINT.tableHeaders,
    ...(value.tableHeaders || {}),
  },
  signatories: normalizeSignatories(value.signatories, DEFAULT_SIGNATORIES),
  confirmedForLabel: String(value.confirmedForLabel ?? DEFAULT_VOUCHER_PRINT.confirmedForLabel).trim() || DEFAULT_VOUCHER_PRINT.confirmedForLabel,
  footerNote: String(value.footerNote ?? '').trim(),
})

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
export const normalizeLogoUploadToDataUrl = async (file) => {
  if (!file || typeof document === 'undefined') return ''
  const type = String(file.type || '').toLowerCase()
  if (type === 'image/svg+xml') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Failed to read logo file'))
      reader.readAsDataURL(file)
    })
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const rendered = await createLogoRenderAsset(objectUrl, 260, 120, 'contain')
    return rendered || objectUrl
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
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
export const createLogoRenderAsset = async (logoUrl, width, height, fit = 'contain') => {
  const safeUrl = sanitizeLogoUrl(logoUrl)
  if (!safeUrl || typeof document === 'undefined') return ''

  const boxWidth = clampBrandingDimension(width, DEFAULT_BRANDING.logoWidth, 80, 260)
  const boxHeight = clampBrandingDimension(height, DEFAULT_BRANDING.logoHeight, 32, 120)

  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = boxWidth
        canvas.height = boxHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve('')
        ctx.clearRect(0, 0, boxWidth, boxHeight)

        if (fit === 'fill') {
          ctx.drawImage(image, 0, 0, boxWidth, boxHeight)
        } else {
          const scale = fit === 'cover'
            ? Math.max(boxWidth / image.width, boxHeight / image.height)
            : Math.min(boxWidth / image.width, boxHeight / image.height)
          const drawWidth = image.width * scale
          const drawHeight = image.height * scale
          const dx = (boxWidth - drawWidth) / 2
          const dy = (boxHeight - drawHeight) / 2
          ctx.drawImage(image, dx, dy, drawWidth, drawHeight)
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
