const JV_MODE_META = {
  journal: { label: 'Normal JV', badge: 'JOURNAL VOUCHER', prefix: 'Jv', referenceType: 'journal' },
  bank_jv: { label: 'Bank JV', badge: 'BANK JOURNAL VOUCHER', prefix: 'BnkJV', referenceType: 'bank_jv' },
}

const emptyJvLine = (id) => ({ id, accountId: '', accountInput: '', description: '', debit: '', credit: '' })

const resolveJvModeMeta = (mode = 'journal') => JV_MODE_META[mode] || JV_MODE_META.journal

const normalizeJvCurrencyCode = (value = '') => {
  const code = String(value || '').trim().toUpperCase()
  if (['SOM', 'SOMS', 'SUM'].includes(code)) return 'UZS'
  return code
}

const convertJvAmountBetweenCurrencies = (amount, fromCurrency, toCurrency, currencies = [], baseCurrencyCode = 'USD') => {
  const value = Number(amount || 0)
  if (!Number.isFinite(value)) return null
  const base = normalizeJvCurrencyCode(baseCurrencyCode || 'USD') || 'USD'
  const from = normalizeJvCurrencyCode(fromCurrency || base)
  const to = normalizeJvCurrencyCode(toCurrency || base)
  if (from === to) return value

  const findRate = (code) => Number((currencies || []).find((currency) => normalizeJvCurrencyCode(currency?.code) === code)?.exchangeRate || 0)
  const fromRate = from === base ? 1 : findRate(from)
  const toRate = to === base ? 1 : findRate(to)

  const valueInBase = from === base ? value : (fromRate > 0 ? value * fromRate : NaN)
  if (!Number.isFinite(valueInBase)) return null
  const converted = to === base ? valueInBase : (toRate > 0 ? valueInBase / toRate : NaN)
  if (!Number.isFinite(converted)) return null
  return Number(converted.toFixed(2))
}

const buildJvDocNo = (ledger = [], mode = 'journal', now = new Date()) => {
  const { prefix, referenceType } = resolveJvModeMeta(mode)
  const year = now.getFullYear()
  const maxExisting = (ledger || []).reduce((max, entry) => {
    if (String(entry?.referenceType || '').toLowerCase() !== String(referenceType || '').toLowerCase()) return max
    const head = String(entry?.description || '').split(' — ')[0].trim()

    const formattedMatch = head.match(/^([A-Z]+)\/(\d{4})\/(\d+)$/i)
    if (formattedMatch) {
      const formattedPrefix = String(formattedMatch[1] || '').toLowerCase()
      const y = Number(formattedMatch[2])
      const n = Number(formattedMatch[3])
      if (formattedPrefix === String(prefix).toLowerCase() && y === year && Number.isFinite(n) && n > max) return n
    }

    const legacyMatch = head.match(/^([A-Z]+)-(\d+)$/i)
    if (legacyMatch) {
      const legacyPrefix = String(legacyMatch[1] || '').toLowerCase()
      const n = Number(legacyMatch[2])
      if (legacyPrefix === String(prefix).toLowerCase() && Number.isFinite(n) && n > max) return n
    }

    return max
  }, 0)

  return `${prefix}/${year}/${String(maxExisting + 1).padStart(4, '0')}`
}

const createJvHeader = (ledger = [], currencyCode = 'USD', mode = 'journal', now = new Date()) => ({
  docNo: buildJvDocNo(ledger, mode, now),
  date: now.toISOString().slice(0, 10),
  narration: '',
  currency: currencyCode,
})

export {
  JV_MODE_META,
  convertJvAmountBetweenCurrencies,
  emptyJvLine,
  normalizeJvCurrencyCode,
  resolveJvModeMeta,
  buildJvDocNo,
  createJvHeader,
}
