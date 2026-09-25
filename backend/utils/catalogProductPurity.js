/**
 * Catalog product purity guards (prevent productPurity=1 leak on karat &lt; 24 names).
 */

function parseKaratFromProductName(productName = '') {
  const match = String(productName || '').trim().match(/(\d+)\s*k\b/i)
  if (!match) return null
  const karat = Number(match[1])
  if (!Number.isFinite(karat) || karat < 1 || karat > 24) return null
  return karat
}

function parseStoredProductPurity(productPurity) {
  const raw = Number.parseFloat(String(productPurity ?? '').trim())
  if (!Number.isFinite(raw) || raw <= 0) return 0
  return raw
}

/**
 * Sanitize purity for catalog products.
 * If name implies karat &lt; 24 and stored purity is blank or exact fine (1), use karat/24.
 */
function sanitizeCatalogProductPurity({ productName = '', productPurity = '' } = {}) {
  const karat = parseKaratFromProductName(productName)
  const karatRatio = karat != null ? Number((karat / 24).toFixed(6)) : null
  const stored = parseStoredProductPurity(productPurity)
  const storedRatio = stored > 1.2 ? stored / 1000 : stored

  const storedIsLeakAsPure =
    karat != null
    && karat < 24
    && storedRatio > 0
    && Math.abs(storedRatio - 1) < 1e-9

  if (stored > 0 && !storedIsLeakAsPure) {
    return String(stored)
  }

  if (karatRatio != null && karatRatio > 0 && karat < 24) {
    return String(karatRatio)
  }

  if (stored > 0) return String(stored)
  if (karatRatio != null && karatRatio > 0) return String(karatRatio)
  return ''
}

/**
 * Rewrite productPurity= in a category meta string using name-based leak guard.
 */
function sanitizeInventoryCategoryPurity(category = '', productName = '') {
  const raw = String(category || '')
  const match = raw.match(/(?:^|;)productPurity=([^;]*)/i)
  const current = match ? match[1] : ''
  const sanitized = sanitizeCatalogProductPurity({ productName, productPurity: current })
  if (!sanitized) return raw

  if (/(?:^|;)productPurity=/i.test(raw)) {
    return raw.replace(/(productPurity=)[^;]*/i, `$1${sanitized}`)
  }
  if (!raw) return `productPurity=${sanitized}`
  return `${raw};productPurity=${sanitized}`
}

module.exports = {
  parseKaratFromProductName,
  sanitizeCatalogProductPurity,
  sanitizeInventoryCategoryPurity,
}
