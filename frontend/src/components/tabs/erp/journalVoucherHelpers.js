const JV_MODE_META = {
  journal: { label: 'Normal JV', badge: 'JOURNAL VOUCHER', prefix: 'Jv', referenceType: 'journal' },
  bank_jv: { label: 'Bank JV', badge: 'BANK JOURNAL VOUCHER', prefix: 'BnkJV', referenceType: 'bank_jv' },
}

const emptyJvLine = (id) => ({ id, accountId: '', accountInput: '', description: '', debit: '', credit: '' })

const resolveJvModeMeta = (mode = 'journal') => JV_MODE_META[mode] || JV_MODE_META.journal

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
  emptyJvLine,
  resolveJvModeMeta,
  buildJvDocNo,
  createJvHeader,
}
