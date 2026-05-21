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

/** First segment of stored JV description (doc no + optional narration tail). */
const jvDescriptionHead = (description) => {
  const raw = String(description || '')
  return (raw.includes(' — ') ? raw.split(' — ')[0] : raw.split(' - ')[0]).trim()
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
    const head = jvDescriptionHead(entry?.description)

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

const extractLedgerJvDocNoFromDescription = (description = '') => {
  const head = jvDescriptionHead(description)
  return /^(jv|bnkjv)[/-]/i.test(head) ? head : ''
}

const extractLedgerJvDetailFromDescription = (description = '') => {
  const raw = String(description || '')
  if (raw.includes(' — ')) {
    const parts = raw.split(' — ')
    if (parts.length <= 1) return ''
    return parts.slice(1).join(' — ').trim()
  }
  const parts = raw.split(' - ')
  if (parts.length <= 1) return ''
  return parts.slice(1).join(' - ').trim()
}

/** Narration hints that the economic currency was som / UZS (legacy rows often stored as base + rate 1). */
const SOM_NARRATION_RE = /(?:\d[\d,]*\s*)?(?:k|m|mil|million)\s*soms?\b|\b\d[\d,]*\s*soms?\b|\bsoms?\b|\buzs\b|\bsum\b(?!\w)/i

const pickFcFromCoaTally = (tally) => {
  if (!tally || tally.size === 0) return null
  if (tally.size === 1) return [...tally.keys()][0]
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1])
  return sorted[0][1] > sorted[1][1] ? sorted[0][0] : null
}

/**
 * For journal/bank_jv lines still stored as base currency + exchangeRate 1, infer which FC
 * the voucher was meant in (COA leg majority, then narration) so the UI can show soms etc.
 */
const inferLegacyJvBatchDisplayFc = (entries, baseCurrencyCode = 'USD') => {
  const base = normalizeJvCurrencyCode(baseCurrencyCode || 'USD') || 'USD'
  if (!Array.isArray(entries) || !entries.length) return null
  const modeOk = (e) => ['journal', 'bank_jv'].includes(String(e?.referenceType || '').toLowerCase())
  if (!entries.every(modeOk)) return null

  for (const e of entries) {
    const cur = normalizeJvCurrencyCode(e?.currency || base)
    const rate = Number(e?.exchangeRate ?? 1)
    if (cur !== base) return cur
    if (Number.isFinite(rate) && Math.abs(rate - 1) > 1e-9) return null
  }

  const tally = new Map()
  for (const e of entries) {
    for (const side of [e?.debitAccountId, e?.creditAccountId]) {
      const raw = side?.currency
      if (raw == null || !String(raw).trim()) continue
      const code = normalizeJvCurrencyCode(raw)
      if (code === base) continue
      tally.set(code, (tally.get(code) || 0) + 1)
    }
  }
  const fromCoa = pickFcFromCoaTally(tally)
  if (fromCoa) return fromCoa

  const blob = entries.map((e) => `${e?.description || ''} ${e?.notes || ''}`).join('\n')
  if (SOM_NARRATION_RE.test(blob)) return 'UZS'
  return null
}

const inferLegacyJvRowDisplayFc = (entry, baseCurrencyCode = 'USD') =>
  inferLegacyJvBatchDisplayFc(entry ? [entry] : [], baseCurrencyCode)

export {
  JV_MODE_META,
  convertJvAmountBetweenCurrencies,
  emptyJvLine,
  normalizeJvCurrencyCode,
  resolveJvModeMeta,
  buildJvDocNo,
  createJvHeader,
  extractLedgerJvDocNoFromDescription,
  extractLedgerJvDetailFromDescription,
  inferLegacyJvBatchDisplayFc,
  inferLegacyJvRowDisplayFc,
}
