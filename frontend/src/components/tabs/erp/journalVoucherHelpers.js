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
    if (!isManualJvLedgerEntry(entry)) return max
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

const isValidMongoObjectId = (value = '') => /^[a-fA-F0-9]{24}$/.test(String(value || '').trim())

/** System FX gain/loss postings tied to transactions — not manual journal vouchers. */
const SYSTEM_FX_ADJUSTMENT_DESC_RE = /Exchange (gain|loss) adjustment for transaction /i

const isSystemFxAdjustmentLedgerEntry = (entry) =>
  SYSTEM_FX_ADJUSTMENT_DESC_RE.test(String(entry?.description || ''))

const isManualJvLedgerEntry = (entry) => {
  const refType = String(entry?.referenceType || '').toLowerCase()
  if (refType !== 'journal' && refType !== 'bank_jv') return false
  if (refType === 'journal' && isSystemFxAdjustmentLedgerEntry(entry)) return false
  return true
}

/** Stable key for grouping multi-line journal / bank_jv ledger postings into one voucher row. */
const jvLedgerGroupKey = (entry) => {
  const refId = String(entry?.referenceId || '').trim()
  if (isValidMongoObjectId(refId)) return `ref:${refId}`
  const docNo = extractLedgerJvDocNoFromDescription(entry?.description)
  if (docNo) {
    const dateKey = entry?.date ? new Date(entry.date).toISOString().slice(0, 10) : ''
    return `doc:${docNo}:${dateKey}`
  }
  return `id:${entry?._id}`
}

const summarizeJvLedgerAccountCodes = (entries, side) => {
  const codes = new Set()
  for (const entry of entries || []) {
    const account = side === 'debit' ? entry?.debitAccountId : entry?.creditAccountId
    const code = String(account?.accountCode || '').trim()
    if (code) codes.add(code)
  }
  return [...codes].sort((a, b) => a.localeCompare(b)).join(', ') || '—'
}

const sumJvLedgerBaseAmount = (entries = []) =>
  entries.reduce((sum, entry) => sum + Number(entry?.amount || 0) * Number(entry?.exchangeRate ?? 1), 0)

/**
 * Collapse paired ledger postings (one row per debit/credit pair) into voucher-level rows
 * for journal and bank_jv list views.
 */
const groupJvLedgerEntries = (entries = [], opts = {}) => {
  const baseNorm = normalizeJvCurrencyCode(opts.baseCurrencyCode || 'USD') || 'USD'
  const buckets = new Map()
  for (const entry of entries || []) {
    const key = jvLedgerGroupKey(entry)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(entry)
  }

  return [...buckets.entries()].map(([key, groupEntries]) => {
    const sorted = [...groupEntries].sort((a, b) => {
      const aTs = new Date(a?.createdAt || a?.date || 0).getTime()
      const bTs = new Date(b?.createdAt || b?.date || 0).getTime()
      return aTs - bTs
    })
    const representative = sorted[0]
    const voucherNo = extractLedgerJvDocNoFromDescription(representative?.description)
      || (String(representative?.referenceType || '').toLowerCase() === 'bank_jv' && representative?.autoTxNo
        ? representative.autoTxNo
        : '—')
    const narration = String(representative?.notes || '').trim()
      || extractLedgerJvDetailFromDescription(representative?.description)
      || '—'

    const repCur = normalizeJvCurrencyCode(representative?.currency || '')
    const allSameCur = sorted.length > 0 && sorted.every((e) => normalizeJvCurrencyCode(e?.currency || repCur) === repCur)
    const documentFaceAmount = allSameCur && repCur && repCur !== baseNorm
      ? Number(sorted.reduce((sum, e) => sum + Number(e?.amount || 0), 0).toFixed(2))
      : null

    return {
      key,
      entries: sorted,
      representative,
      entryIds: sorted.map((entry) => entry._id).filter(Boolean),
      lineCount: sorted.length,
      voucherNo,
      date: representative?.date,
      referenceType: representative?.referenceType,
      narration,
      debitAccounts: summarizeJvLedgerAccountCodes(sorted, 'debit'),
      creditAccounts: summarizeJvLedgerAccountCodes(sorted, 'credit'),
      totalBaseAmount: sumJvLedgerBaseAmount(sorted),
      documentCurrencyCode: documentFaceAmount != null ? repCur : '',
      documentFaceAmount,
      attachmentUrl: sorted.find((entry) => entry?.attachmentUrl)?.attachmentUrl || '',
      autoTxNo: sorted.find((entry) => entry?.autoTxNo)?.autoTxNo || '',
      chequeNo: sorted.find((entry) => entry?.chequeNo)?.chequeNo || '',
    }
  })
}

const validateJvLines = ({
  lines = [],
  jvMode = 'journal',
  jvHeader = {},
  baseCurrencyCode = 'USD',
  inventoryTenantKey = '',
  inferJvAccountCurrency = () => baseCurrencyCode,
  convertJvAmount = (amount) => Number(amount || 0),
  isExchangeLine = () => false,
  normalizeJvCurrencyCode: normCur = normalizeJvCurrencyCode,
} = {}) => {
  const lineIssuesById = {}
  const activeLines = []
  let totalDebit = 0
  let totalCredit = 0
  let totalDebitRaw = 0
  let totalCreditRaw = 0
  const headerCur = normCur(jvHeader.currency || baseCurrencyCode)
  const baseNorm = normCur(baseCurrencyCode)
  const useDocCurrency = headerCur !== baseNorm
  const loopcJournalHeaderLineCurrency = inventoryTenantKey === 'loopc' && jvMode === 'journal'
  const treatLineAmountsAsHeaderCurrency = Boolean(loopcJournalHeaderLineCurrency || useDocCurrency)

  lines.forEach((line, index) => {
    const debit = Number(line.debit || 0)
    const credit = Number(line.credit || 0)
    const debitRawValue = Number.isFinite(debit) && debit > 0 ? debit : 0
    const creditRawValue = Number.isFinite(credit) && credit > 0 ? credit : 0
    totalDebitRaw += debitRawValue
    totalCreditRaw += creditRawValue
    const accountId = String(line.accountId || '').trim()
    const hasNarration = String(line.description || '').trim().length > 0
    const hasAmount = debitRawValue > 0 || creditRawValue > 0
    const hasTyped = hasAmount || hasNarration || accountId
    let debitValue = debitRawValue
    let creditValue = creditRawValue

    if (accountId) {
      const lineAmountCurrency = treatLineAmountsAsHeaderCurrency ? headerCur : inferJvAccountCurrency(accountId)
      if (debitRawValue > 0) {
        const normalizedDebit = convertJvAmount(debitRawValue, lineAmountCurrency, baseNorm)
        if (!Number.isFinite(normalizedDebit) || normalizedDebit <= 0) {
          lineIssuesById[line.id] = `Row ${index + 1}: Missing or invalid currency rate for ${lineAmountCurrency}`
        } else {
          debitValue = normalizedDebit
        }
      }
      if (creditRawValue > 0) {
        const normalizedCredit = convertJvAmount(creditRawValue, lineAmountCurrency, baseNorm)
        if (!Number.isFinite(normalizedCredit) || normalizedCredit <= 0) {
          lineIssuesById[line.id] = `Row ${index + 1}: Missing or invalid currency rate for ${lineAmountCurrency}`
        } else {
          creditValue = normalizedCredit
        }
      }
    }

    if (debitValue > 0 && creditValue > 0) {
      lineIssuesById[line.id] = `Row ${index + 1}: Only one side allowed per row`
    } else if (hasTyped && !hasAmount && !(jvMode === 'bank_jv' && isExchangeLine(line))) {
      lineIssuesById[line.id] = `Row ${index + 1}: Enter debit or credit amount`
    } else if (hasAmount && !accountId) {
      lineIssuesById[line.id] = `Row ${index + 1}: Account is required`
    }

    totalDebit += debitValue
    totalCredit += creditValue
    if (!lineIssuesById[line.id] && hasAmount && accountId) {
      activeLines.push({
        id: line.id,
        accountId,
        description: String(line.description || '').trim(),
        debit: debitValue,
        credit: creditValue,
      })
    }
  })

  const difference = Number((totalDebit - totalCredit).toFixed(2))
  const hasLineIssues = Object.keys(lineIssuesById).length > 0
  const hasDebit = totalDebit > 0
  const hasCredit = totalCredit > 0
  const isBalanced = hasDebit && hasCredit && Math.abs(difference) < 0.005
  const canSave = !hasLineIssues && isBalanced && activeLines.length > 1
  const displayTotalCurrency = treatLineAmountsAsHeaderCurrency ? headerCur : baseNorm
  const displayDebitTotal = treatLineAmountsAsHeaderCurrency ? Number(totalDebitRaw.toFixed(2)) : totalDebit
  const displayCreditTotal = treatLineAmountsAsHeaderCurrency ? Number(totalCreditRaw.toFixed(2)) : totalCredit
  const useRawJvLineAmountsForSave = Boolean(useDocCurrency || loopcJournalHeaderLineCurrency)

  return {
    activeLines,
    lineIssuesById,
    totalDebit,
    totalCredit,
    totalDebitRaw,
    totalCreditRaw,
    useDocCurrency,
    useRawJvLineAmountsForSave,
    displayTotalCurrency,
    displayDebitTotal,
    displayCreditTotal,
    difference,
    isBalanced,
    canSave,
    hasLineIssues,
  }
}

const allocateJvLedgerEntries = (activeLines = [], { jvLines = [], useRawJvLineAmountsForSave = false } = {}) => {
  let debitQueue
  let creditQueue
  if (useRawJvLineAmountsForSave) {
    debitQueue = jvLines
      .filter((line) => String(line.accountId || '').trim() && Number(line.debit || 0) > 0)
      .map((line) => ({
        accountId: line.accountId,
        description: String(line.description || '').trim(),
        remaining: Number(Number(line.debit || 0).toFixed(2)),
      }))
    creditQueue = jvLines
      .filter((line) => String(line.accountId || '').trim() && Number(line.credit || 0) > 0)
      .map((line) => ({
        accountId: line.accountId,
        description: String(line.description || '').trim(),
        remaining: Number(Number(line.credit || 0).toFixed(2)),
      }))
  } else {
    debitQueue = activeLines
      .filter((line) => line.debit > 0)
      .map((line) => ({ ...line, remaining: Number(line.debit.toFixed(2)) }))
    creditQueue = activeLines
      .filter((line) => line.credit > 0)
      .map((line) => ({ ...line, remaining: Number(line.credit.toFixed(2)) }))
  }

  if (!debitQueue.length || !creditQueue.length) {
    return {
      entries: [],
      error: 'JV requires at least one debit row and one credit row',
    }
  }

  const entries = []
  let drIndex = 0
  let crIndex = 0
  while (drIndex < debitQueue.length && crIndex < creditQueue.length) {
    const debitLine = debitQueue[drIndex]
    const creditLine = creditQueue[crIndex]
    const pairAmount = Math.min(debitLine.remaining, creditLine.remaining)
    if (pairAmount > 0) {
      entries.push({
        debitAccountId: debitLine.accountId,
        creditAccountId: creditLine.accountId,
        amount: Number(pairAmount.toFixed(2)),
        lineDesc: [debitLine.description, creditLine.description].filter(Boolean).join(' | '),
      })
    }
    debitLine.remaining = Number((debitLine.remaining - pairAmount).toFixed(2))
    creditLine.remaining = Number((creditLine.remaining - pairAmount).toFixed(2))
    if (debitLine.remaining <= 0.004) drIndex += 1
    if (creditLine.remaining <= 0.004) crIndex += 1
  }

  const debitRemainder = debitQueue.reduce((sum, line) => sum + Math.max(0, line.remaining), 0)
  const creditRemainder = creditQueue.reduce((sum, line) => sum + Math.max(0, line.remaining), 0)
  if (debitRemainder > 0.01 || creditRemainder > 0.01) {
    return {
      entries,
      error: 'Failed to allocate JV lines into balanced ledger entries',
    }
  }

  return { entries, error: '' }
}

const getJvAccountByIdFromOptions = (accountId, entryAccountOptions = []) =>
  entryAccountOptions.find((item) => String(item?._id) === String(accountId || '')) || null

const getJvAccountCodeFromOptions = (accountId, entryAccountOptions) =>
  String(getJvAccountByIdFromOptions(accountId, entryAccountOptions)?.accountCode || '').trim().toUpperCase()

const isExchangeAccountCode = (code) => ['4190', '5190'].includes(String(code || '').trim().toUpperCase())

const isExchangeJvLine = (line, entryAccountOptions) =>
  isExchangeAccountCode(getJvAccountCodeFromOptions(line?.accountId, entryAccountOptions))

/** Bank JV: auto-balance FX gain/loss (4190/5190) when user has not entered manual FX amounts. */
function applyBankJvExchangeBalancing(lines, ctx) {
  const {
    jvMode,
    entryAccountOptions = [],
    baseCurrencyCode = 'USD',
    convertJvAmount,
    inferJvAccountCurrency,
    accountLookupText,
  } = ctx
  if (jvMode !== 'bank_jv') return lines
  const hasManualFxEntry = lines.some((line) => {
    if (!isExchangeJvLine(line, entryAccountOptions)) return false
    const hasAmount = Number(line.debit || 0) > 0 || Number(line.credit || 0) > 0
    return hasAmount && !line.autoFx
  })
  if (hasManualFxEntry) return lines
  const withoutFxAmounts = lines.map((line) => (
    isExchangeJvLine(line, entryAccountOptions) && line.autoFx
      ? { ...line, debit: '', credit: '' }
      : line
  ))
  const nonFxLines = withoutFxAmounts.filter((line) => String(line.accountId || '').trim() && !isExchangeJvLine(line, entryAccountOptions))
  if (nonFxLines.length < 2) return withoutFxAmounts
  let baseDebit = 0
  let baseCredit = 0
  for (const line of nonFxLines) {
    const accountCurrency = inferJvAccountCurrency(line.accountId)
    const debitRaw = Number(line.debit || 0)
    const creditRaw = Number(line.credit || 0)
    const debitValue = Number.isFinite(debitRaw) && debitRaw > 0 ? debitRaw : 0
    const creditValue = Number.isFinite(creditRaw) && creditRaw > 0 ? creditRaw : 0
    if (debitValue > 0) {
      const normalizedDebit = convertJvAmount(debitValue, accountCurrency, baseCurrencyCode)
      if (!Number.isFinite(normalizedDebit)) return withoutFxAmounts
      baseDebit += normalizedDebit
    }
    if (creditValue > 0) {
      const normalizedCredit = convertJvAmount(creditValue, accountCurrency, baseCurrencyCode)
      if (!Number.isFinite(normalizedCredit)) return withoutFxAmounts
      baseCredit += normalizedCredit
    }
  }
  const difference = Number((baseDebit - baseCredit).toFixed(2))
  if (Math.abs(difference) < 0.005) return withoutFxAmounts
  const needsDebitFx = difference < 0
  const targetCode = needsDebitFx ? '5190' : '4190'
  const targetAccount = entryAccountOptions.find((item) => String(item?.accountCode || '').trim().toUpperCase() === targetCode)
  if (!targetAccount?._id) return withoutFxAmounts
  const withoutFxAmountsLocal = withoutFxAmounts
  let targetLine = withoutFxAmountsLocal.find((line) => getJvAccountCodeFromOptions(line.accountId, entryAccountOptions) === targetCode)
    || withoutFxAmountsLocal.find((line) => isExchangeJvLine(line, entryAccountOptions))
    || withoutFxAmountsLocal.find((line) => {
      const hasAccount = String(line.accountId || '').trim().length > 0
      const hasAmount = Number(line.debit || 0) > 0 || Number(line.credit || 0) > 0
      const hasNarration = String(line.description || '').trim().length > 0
      return !hasAccount && !hasAmount && !hasNarration
    })
  let workingLines = withoutFxAmountsLocal
  if (!targetLine) {
    const nextId = Math.max(0, ...withoutFxAmountsLocal.map((line) => Number(line.id || 0))) + 1
    targetLine = { id: nextId, accountId: '', accountInput: '', description: '', debit: '', credit: '', autoFx: true }
    workingLines = [...withoutFxAmountsLocal, targetLine]
  }
  const targetCurrency = inferJvAccountCurrency(targetAccount._id)
  const fxAmount = convertJvAmount(Math.abs(difference), baseCurrencyCode, targetCurrency)
  if (!Number.isFinite(fxAmount) || fxAmount <= 0) return workingLines
  return workingLines.map((line) => {
    if (line.id !== targetLine.id) return line
    return {
      ...line,
      accountId: String(targetAccount._id),
      accountInput: accountLookupText(targetAccount),
      debit: needsDebitFx ? String(fxAmount) : '',
      credit: needsDebitFx ? '' : String(fxAmount),
      autoFx: true,
    }
  })
}

function filterJvEditableEntries(docMatchedEntries, entry, entryMode) {
  const reversedEntryIds = new Set(
    docMatchedEntries
      .filter((e) => String(e?.referenceType || '').toLowerCase() === 'reversal')
      .map((e) => String(e?.referenceId || String(e?.description || '').match(/REVERSAL of Entry\s+([a-f0-9]{24})/i)?.[1] || '').trim())
      .filter(Boolean),
  )
  const entryDateKey = entry?.date ? new Date(entry.date).toISOString().slice(0, 10) : ''
  return docMatchedEntries.filter((e) => {
    const refType = String(e?.referenceType || '').toLowerCase()
    if (refType !== entryMode) return false
    const rowDateKey = e?.date ? new Date(e.date).toISOString().slice(0, 10) : ''
    if (entryDateKey && rowDateKey !== entryDateKey) return false
    return !reversedEntryIds.has(String(e?._id || ''))
  })
}

/**
 * Per-posting line detail from stored `description` (em dash segments).
 * When header narration is empty, save format is `docNo — lineDesc` (2 segments); when set,
 * line-specific text is `docNo — narr — lineDesc` (3+ segments). Use batch `notes` to tell
 * apart header-only second segment vs line text.
 */
function extractJvPostingLineDescription(description = '', batchHeaderNotes = '') {
  const parts = String(description || '').split(' — ')
  if (parts.length >= 3) return parts.slice(2).join(' — ').trim()
  if (parts.length === 2) {
    const tail = parts[1].trim()
    if (!tail) return ''
    const notesNorm = String(batchHeaderNotes || '').trim()
    if (notesNorm && tail === notesNorm) return ''
    return tail
  }
  return ''
}

/**
 * Header narration for JV edit modal — mirrors groupJvLedgerEntries list display.
 */
function resolveJvHeaderNarrationFromBatch(sorted = [], entry = null) {
  const batchNotes = String(sorted[0]?.notes || '').trim()
  if (batchNotes) return batchNotes

  const representative = sorted[0] || entry
  const rawDesc = String(representative?.description || '')
  const parts = rawDesc.includes(' — ') ? rawDesc.split(' — ') : []
  if (parts.length >= 3) return parts[1].trim()
  return extractLedgerJvDetailFromDescription(rawDesc)
}

/**
 * Merge consecutive JV edit lines that post the same side (debit-only or credit-only) to the
 * same account — typical when several ledger rows share one cash/bank line on edit.
 */
function mergeConsecutiveJvLinesSameAccountAndSide(lines) {
  if (!Array.isArray(lines) || lines.length < 2) return lines
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const d = Number(line.debit || 0)
    const c = Number(line.credit || 0)
    const aid = String(line.accountId || '')
    if (aid && d > 0 && !c) {
      let total = d
      let j = i + 1
      while (j < lines.length) {
        const l2 = lines[j]
        const d2 = Number(l2.debit || 0)
        const c2 = Number(l2.credit || 0)
        if (String(l2.accountId || '') === aid && d2 > 0 && !c2) {
          total += d2
          j += 1
        } else break
      }
      out.push({ ...line, debit: Number(total.toFixed(2)), credit: '' })
      i = j
      continue
    }
    if (aid && c > 0 && !d) {
      let total = c
      let j = i + 1
      while (j < lines.length) {
        const l2 = lines[j]
        const d2 = Number(l2.debit || 0)
        const c2 = Number(l2.credit || 0)
        if (String(l2.accountId || '') === aid && c2 > 0 && !d2) {
          total += c2
          j += 1
        } else break
      }
      out.push({ ...line, debit: '', credit: Number(total.toFixed(2)) })
      i = j
      continue
    }
    out.push(line)
    i += 1
  }
  return out
}

/**
 * Rebuild JV modal lines from ledger rows. Consecutive same-account debit (or credit) lines are
 * merged for editing. Order follows FIFO sort on createdAt/date then _id.
 */
function reconstructJvEditLines(editableEntries, entry, {
  baseCurrencyCode = 'USD',
  normalizeJvCurrencyCode: normCur = normalizeJvCurrencyCode,
  convertJvAmount,
  inferJvAccountCurrency,
  inferLegacyJvBatchDisplayFc,
} = {}) {
  const sorted = [...(editableEntries || [])].sort((a, b) => {
    const aTs = new Date(a?.createdAt || a?.date || 0).getTime()
    const bTs = new Date(b?.createdAt || b?.date || 0).getTime()
    if (aTs !== bTs) return aTs - bTs
    return String(a?._id || '').localeCompare(String(b?._id || ''))
  })

  const firstEntryCur = normCur((sorted[0] || entry)?.currency || baseCurrencyCode)
  const allEntriesSameCur = sorted.length > 0 && sorted.every((row) => (
    normCur(row.currency || firstEntryCur) === firstEntryCur
  ))
  const showAsBatchCur = allEntriesSameCur && firstEntryCur !== normCur(baseCurrencyCode)
  const batchNotes = String(sorted[0]?.notes || '').trim()
  const narration = resolveJvHeaderNarrationFromBatch(sorted, entry)
  const representativeDesc = String((sorted[0] || entry)?.description || '')
  const descParts = representativeDesc.includes(' — ') ? representativeDesc.split(' — ') : []
  const dedupeLineDescFromHeader = !batchNotes
    && descParts.length === 2
    && narration
    && narration === extractJvPostingLineDescription(representativeDesc, '')

  let id = 1
  const lines = []
  for (const e of sorted) {
    const entryCur = normCur(e.currency || baseCurrencyCode)
    const drId = e.debitAccountId?._id
    const crId = e.creditAccountId?._id
    let lineDesc = extractJvPostingLineDescription(e.description, batchNotes || narration)
    if (dedupeLineDescFromHeader && lineDesc === narration) lineDesc = ''
    if (drId && e.debitAccountId) {
      const displayDebit = showAsBatchCur
        ? Number(e.amount || 0)
        : convertJvAmount(e.amount, entryCur, inferJvAccountCurrency(drId))
      const debitAmount = Number.isFinite(Number(displayDebit)) ? Number(displayDebit) : Number(e.amount || 0)
      lines.push({
        id: id++,
        accountId: drId,
        accountInput: `${e.debitAccountId.accountCode} - ${e.debitAccountId.accountName}`,
        description: lineDesc,
        debit: Number(debitAmount.toFixed(2)),
        credit: '',
      })
    }
    if (crId && e.creditAccountId) {
      const displayCredit = showAsBatchCur
        ? Number(e.amount || 0)
        : convertJvAmount(e.amount, entryCur, inferJvAccountCurrency(crId))
      const creditAmount = Number.isFinite(Number(displayCredit)) ? Number(displayCredit) : Number(e.amount || 0)
      lines.push({
        id: id++,
        accountId: crId,
        accountInput: `${e.creditAccountId.accountCode} - ${e.creditAccountId.accountName}`,
        description: lineDesc,
        debit: '',
        credit: Number(creditAmount.toFixed(2)),
      })
    }
  }

  const mergedLines = mergeConsecutiveJvLinesSameAccountAndSide(lines)

  const rawDesc = String(entry.description || '')
  const docNoHead = (rawDesc.includes(' — ') ? rawDesc.split(' — ') : rawDesc.split(' - '))[0]?.trim() || ''
  const docNo = docNoHead
  const hasDocPrefix = /^(jv|bnkjv)[/-]/i.test(String(docNo || ''))
  const entryMode = String(entry?.referenceType || '').toLowerCase() === 'bank_jv' ? 'bank_jv' : 'journal'
  const entryIdStr = String(entry?._id || '')
  const headerDocNo = (docNo && hasDocPrefix) ? docNo : `${resolveJvModeMeta(entryMode).prefix}-EDIT-${entryIdStr.slice(-6)}`
  const legacyBatchFc = inferLegacyJvBatchDisplayFc(sorted, baseCurrencyCode)
  const headerCurrency = legacyBatchFc
    || normCur((sorted[0] || entry).currency || baseCurrencyCode)
  const primaryRow = sorted[0] || entry
  const dateRaw = primaryRow?.date || primaryRow?.createdAt || entry?.date || entry?.createdAt
  const parsedEntryDate = new Date(dateRaw)
  const entryDate = Number.isFinite(parsedEntryDate.getTime())
    ? parsedEntryDate.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  return {
    lines: mergedLines,
    nextJvLineId: id,
    narration,
    headerDocNo,
    headerCurrency,
    jvEditEntryIds: sorted.map((row) => row._id),
    entryMode,
    hasDocPrefix,
    entryDate,
  }
}

/** 24-char hex ObjectId-style batch id for multi-line JV posting groups. */
function makeJvGroupObjectId() {
  const hex = '0123456789abcdef'
  let s = ''
  for (let i = 0; i < 24; i += 1) s += hex[Math.floor(Math.random() * 16)]
  return s
}

/** Build createLedgerEntry payloads for a balanced multi-line JV (header currency vs base). */
function buildJvPostingPayloads({
  entries,
  jvHeader,
  baseCurrencyCode,
  currencies = [],
  jvMode,
  jvGroupId,
  normalizeJvCurrencyCode: normCur = normalizeJvCurrencyCode,
  strictUseDocCurrency = false,
} = {}) {
  const isBankJV = jvMode === 'bank_jv'
  const sharedDesc = [jvHeader.docNo, jvHeader.narration].filter(Boolean).join(' — ') || 'Manual JV'
  const headerCur = normCur(jvHeader.currency || baseCurrencyCode)
  const baseCur = normCur(baseCurrencyCode)
  let headerFxRate = 1
  if (headerCur !== baseCur) {
    const curRow = currencies.find((c) => normCur(c?.code) === headerCur)
    headerFxRate = Number(curRow?.exchangeRate || 0)
    if (!Number.isFinite(headerFxRate) || headerFxRate <= 0) {
      return {
        error: `Cannot post in ${headerCur}: add an active ${headerCur} currency with exchangeRate (vs ${baseCur}) in Master → Currencies.`,
        payloads: null,
      }
    }
    if (!strictUseDocCurrency) {
      for (const row of entries) {
        const fcRaw = Number(row.amount) / headerFxRate
        const postAmt = headerFxRate < 0.001 ? Math.round(fcRaw) : Number(fcRaw.toFixed(2))
        if (!Number.isFinite(postAmt) || postAmt <= 0) {
          return {
            error: 'A JV line would round to zero in the header currency; adjust amounts or the FX rate.',
            payloads: null,
          }
        }
      }
    }
  }
  const payloads = entries.map((entry) => {
    const pairBase = Number(entry.amount)
    let postAmount = pairBase
    let postCurrency = baseCur
    let postRate = 1
    if (headerCur !== baseCur) {
      if (strictUseDocCurrency) {
        postAmount = pairBase
        postCurrency = headerCur
        postRate = headerFxRate
      } else {
        const fcRaw = pairBase / headerFxRate
        postAmount = headerFxRate < 0.001 ? Math.round(fcRaw) : Number(fcRaw.toFixed(2))
        postCurrency = headerCur
        postRate = headerFxRate
      }
    }
    return {
      date: jvHeader.date,
      description: entry.lineDesc ? `${sharedDesc} — ${entry.lineDesc}` : sharedDesc,
      notes: jvHeader.narration || '',
      referenceType: isBankJV ? 'bank_jv' : 'journal',
      referenceId: jvGroupId,
      currency: postCurrency,
      exchangeRate: postRate,
      debitAccountId: entry.debitAccountId,
      creditAccountId: entry.creditAccountId,
      amount: postAmount,
    }
  })
  return { error: null, payloads }
}

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const formatJvPrintAmount = (value) => (
  Number(value || 0) > 0
    ? Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : ''
)

const buildJvPrintHtml = ({
  validation = {},
  jvLines = [],
  jvHeader = {},
  modeMeta = resolveJvModeMeta(),
  branding = {},
  defaultCompanyName = 'Ops Dashboard ERP',
  baseCurrencyCode = 'USD',
  preparedBy = '',
  logoMarkup = '',
  getJvAccountById = () => null,
} = {}) => {
  const printLines = Array.isArray(validation.activeLines) && validation.activeLines.length
    ? validation.activeLines
    : jvLines
  const rows = printLines
    .map((line, index) => {
      const account = getJvAccountById(line.accountId)
      const accountText = account
        ? `${account.accountCode || ''} - ${account.accountName || ''}`
        : (line.accountInput || line.accountId || '')
      return `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(accountText)}</td>
            <td>${escapeHtml(line.description || jvHeader.narration || '')}</td>
            <td class="num">${formatJvPrintAmount(line.debit)}</td>
            <td class="num">${formatJvPrintAmount(line.credit)}</td>
          </tr>
        `
    })
    .join('')

  return `
      <div class="doc-head">
        <div>
          <div class="company">${escapeHtml(branding.companyName || defaultCompanyName)}</div>
          ${branding.address ? `<div class="meta">${escapeHtml(branding.address).replace(/\n/g, '<br />')}</div>` : ''}
          ${branding.phone ? `<div class="meta">Telephone: ${escapeHtml(branding.phone)}</div>` : ''}
          ${branding.trn ? `<div class="meta">TRN: ${escapeHtml(branding.trn)}</div>` : ''}
        </div>
        ${logoMarkup}
      </div>
      <h1>${escapeHtml(modeMeta.badge)}</h1>
      <div class="meta-grid">
        <div><strong>Doc No:</strong> ${escapeHtml(jvHeader.docNo || '')}</div>
        <div><strong>Date:</strong> ${escapeHtml(jvHeader.date || '')}</div>
        <div><strong>Currency:</strong> ${escapeHtml(jvHeader.currency || baseCurrencyCode)}</div>
        <div><strong>Prepared By:</strong> ${escapeHtml(preparedBy)}</div>
      </div>
      <table>
        <thead><tr><th>No.</th><th>Account</th><th>Narration</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5">No JV rows</td></tr>'}</tbody>
        <tfoot><tr><td colspan="3" class="num">Total</td><td class="num">${Number(validation.displayDebitTotal ?? validation.totalDebit ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td class="num">${Number(validation.displayCreditTotal ?? validation.totalCredit ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr></tfoot>
      </table>
      <div class="note">${escapeHtml(jvHeader.narration || '')}</div>
      <div class="signatures">
        <div>Prepared By</div>
        <div>Checked By</div>
        <div>Authorised Signatory</div>
      </div>
    `
}

export {
  JV_MODE_META,
  allocateJvLedgerEntries,
  applyBankJvExchangeBalancing,
  buildJvPostingPayloads,
  buildJvPrintHtml,
  convertJvAmountBetweenCurrencies,
  emptyJvLine,
  filterJvEditableEntries,
  makeJvGroupObjectId,
  normalizeJvCurrencyCode,
  reconstructJvEditLines,
  resolveJvModeMeta,
  buildJvDocNo,
  createJvHeader,
  extractLedgerJvDocNoFromDescription,
  extractLedgerJvDetailFromDescription,
  extractJvPostingLineDescription,
  resolveJvHeaderNarrationFromBatch,
  inferLegacyJvBatchDisplayFc,
  inferLegacyJvRowDisplayFc,
  isManualJvLedgerEntry,
  isSystemFxAdjustmentLedgerEntry,
  groupJvLedgerEntries,
  jvLedgerGroupKey,
  sumJvLedgerBaseAmount,
  validateJvLines,
}
