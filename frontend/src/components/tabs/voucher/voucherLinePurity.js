/**
 * Voucher metal-line purity resolution from inventory product meta / karat names.
 */

/** Parse leading karat from names like "22k alloy" or "18K". Returns 1–24 or null. */
export function parseKaratFromProductName(productName = '') {
  const match = String(productName || '').trim().match(/(\d+)\s*k\b/i)
  if (!match) return null
  const karat = Number(match[1])
  if (!Number.isFinite(karat) || karat < 1 || karat > 24) return null
  return karat
}

/** Normalize stored purity (ratio or millesimal) to a finite number; blank/invalid → 0. */
export function parseStoredProductPurity(productPurity) {
  const raw = Number.parseFloat(String(productPurity ?? '').trim())
  if (!Number.isFinite(raw) || raw <= 0) return 0
  return raw
}

/**
 * Resolve line purity for metal vouchers.
 * Prefer catalog productPurity unless it is blank/0, or exactly ratio 1 while the
 * product name implies karat < 24 (common leak from Pure Gold form state).
 */
export function resolveVoucherLinePurityFromProduct({ productName = '', productPurity = '' } = {}) {
  const karat = parseKaratFromProductName(productName)
  const karatRatio = karat != null ? karat / 24 : null
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

  if (karatRatio != null && karatRatio > 0) {
    // Keep enough precision for 22/24 without long float noise.
    return String(Number(karatRatio.toFixed(6)))
  }

  return stored > 0 ? String(stored) : ''
}

/**
 * Pick catalog product for a voucher line from the stock-scoped list
 * (same source as the Product Type dropdown).
 */
export function resolveCatalogProductForVoucherLine({
  catalogProducts = [],
  productName = '',
  inventoryItemId = '',
} = {}) {
  const list = Array.isArray(catalogProducts) ? catalogProducts : []
  const id = String(inventoryItemId || '').trim()
  if (id) {
    const byId = list.find((item) => String(item?._id || '') === id)
    if (byId) return byId
  }
  const name = String(productName || '').trim().toLowerCase()
  if (!name) return null
  return list.find((item) => String(item?.name || '').trim().toLowerCase() === name) || null
}
