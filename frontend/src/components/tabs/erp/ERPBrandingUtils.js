/**
 * ERP report branding utilities.
 * Pure helpers — no React, no API calls, no side effects.
 */

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
}

export const DEFAULT_BRANDING_PROFILES = [{
  key: DEFAULT_BRANDING.key,
  entityName: DEFAULT_BRANDING.entityName,
  branchName: DEFAULT_BRANDING.branchName,
  companyName: DEFAULT_BRANDING.companyName,
  isDefault: DEFAULT_BRANDING.isDefault,
}]

export const LOGO_UPLOAD_ACCEPT = 'image/png,image/svg+xml,.png,.svg'
export const SUPPORTED_LOGO_MIME_TYPES = new Set(['image/png', 'image/svg+xml'])
export const SUPPORTED_LOGO_EXTENSIONS = new Set(['png', 'svg'])

export const isSupportedLogoUpload = (file = {}) => {
  const type = String(file?.type || '').trim().toLowerCase()
  const extension = String(file?.name || '').split('.').pop()?.trim().toLowerCase()
  return SUPPORTED_LOGO_MIME_TYPES.has(type) || SUPPORTED_LOGO_EXTENSIONS.has(extension)
}

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
 * Renders a logo URL onto an off-screen canvas and returns a base64 PNG data URL.
 * Returns the original URL on error, or an empty string when no URL is provided.
 * @param {string} logoUrl
 * @param {number} width
 * @param {number} height
 * @param {'contain'|'cover'|'fill'} fit
 * @returns {Promise<string>}
 */
export const createLogoRenderAsset = async (logoUrl, width, height, fit = 'contain') => {
  if (!logoUrl || typeof document === 'undefined') return ''

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
        if (!ctx) return resolve(logoUrl)
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
        resolve(logoUrl)
      }
    }
    image.onerror = () => resolve(logoUrl)
    image.src = logoUrl
  })
}
