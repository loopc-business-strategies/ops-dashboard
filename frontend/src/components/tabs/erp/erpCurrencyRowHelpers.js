/** Stored rate = base currency units per 1 unit of this row’s currency, from quote "1 {base} = n units" (n > 0). */
export function exchangeRateFromUnitsPerBase(unitsPerBase) {
  const n = Number(String(unitsPerBase ?? '').trim())
  if (!Number.isFinite(n) || n <= 0) return null
  return 1 / n
}

/**
 * Resolve a currency row by code (case-insensitive, trim). If multiple rows share the same code
 * (e.g. legacy duplicates), prefer active rows; for non-base codes prefer non-base rows and
 * the highest exchangeRate so the converter matches the table.
 */
export function resolveCurrencyRowByCode(currencies, rawCode, baseCurrencyCode = 'USD') {
  const want = String(rawCode || '').trim().toUpperCase()
  if (!want) return null
  const base = String(baseCurrencyCode || 'USD').trim().toUpperCase() || 'USD'
  const list = Array.isArray(currencies) ? currencies : []
  let matches = list.filter((c) => String(c?.code || '').trim().toUpperCase() === want)
  if (!matches.length) return null
  matches = matches.filter((c) => c?.isActive !== false)
  if (!matches.length) return null
  if (want === base) {
    return matches.find((c) => c.baseCurrency) || matches[0]
  }
  const nonBase = matches.filter((c) => !c.baseCurrency)
  const pool = nonBase.length ? nonBase : matches
  return pool.slice().sort((a, b) => Number(b?.exchangeRate || 0) - Number(a?.exchangeRate || 0))[0]
}
