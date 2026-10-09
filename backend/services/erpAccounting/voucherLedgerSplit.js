/**
 * Split a voucher's single main ledger row when lines belong to different accounts.
 * Receipt/payment: one row per cash or bank account.
 * Purchase: one row per stock account.
 * A single account stays one row. Metal receipt, metal payment, and metal transfer are not split.
 */

const AMOUNT_TOLERANCE = 0.02

function toMoney(value) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 100) / 100
}

function amountsMatch(left, right) {
  return Math.abs(toMoney(left) - toMoney(right)) <= AMOUNT_TOLERANCE
}

function settlementBaseParts(line, exchangeRate) {
  const lc = Number(line?.amountLC || 0)
  const fc = Number(line?.amountFC || 0)
  const lineRate = Number(line?.currRate || exchangeRate || 1)
  const rate = Number.isFinite(lineRate) && lineRate > 0 ? lineRate : 1
  return {
    lc: Number.isFinite(lc) ? lc : 0,
    converted: (Number.isFinite(fc) ? fc : 0) * rate,
  }
}

function planSettlementSplit({ type, lines, exchangeRate, mainAmount }) {
  const normalizedType = String(type || '').toLowerCase()
  if (!['receipt', 'payment'].includes(normalizedType)) return null
  if (!Array.isArray(lines) || lines.length < 2) return null

  const parsed = lines.map((line) => ({
    accountCode: String(line?.acCode || '').trim(),
    ...settlementBaseParts(line, exchangeRate),
  })).filter((line) => line.accountCode)

  if (parsed.length < 2) return null
  const distinct = new Set(parsed.map((line) => line.accountCode.toUpperCase()))
  if (distinct.size < 2) return null

  const sumLc = toMoney(parsed.reduce((sum, line) => sum + line.lc, 0))
  const sumConverted = toMoney(parsed.reduce((sum, line) => sum + line.converted, 0))
  const useLc = amountsMatch(sumLc, mainAmount)
  const useConverted = !useLc && amountsMatch(sumConverted, mainAmount)
  if (!useLc && !useConverted) return null

  const grouped = new Map()
  for (const line of parsed) {
    const key = line.accountCode.toUpperCase()
    const amount = useLc ? line.lc : line.converted
    grouped.set(key, toMoney((grouped.get(key) || 0) + amount))
  }

  const slices = [...grouped.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([accountCode, amount]) => ({
      accountCode: parsed.find((line) => line.accountCode.toUpperCase() === accountCode).accountCode,
      amount: toMoney(amount),
    }))

  if (slices.length < 2) return null
  if (!amountsMatch(slices.reduce((sum, slice) => sum + slice.amount, 0), mainAmount)) return null
  return { kind: 'settlement', type: normalizedType, slices }
}

function planPurchaseInventorySplit({ plans, mainAmount }) {
  const grouped = new Map()
  for (const plan of Array.isArray(plans) ? plans : []) {
    const accountId = String(plan?.inventoryAccountId?._id || plan?.inventoryAccountId || '').trim()
    const amount = Number(plan?.lineAmount || 0)
    if (!accountId || !Number.isFinite(amount) || amount <= 0) continue
    grouped.set(accountId, toMoney((grouped.get(accountId) || 0) + amount))
  }
  if (grouped.size < 2) return null

  const slices = [...grouped.entries()].map(([accountId, amount]) => ({
    accountId,
    amount: toMoney(amount),
  }))
  if (!amountsMatch(slices.reduce((sum, slice) => sum + slice.amount, 0), mainAmount)) return null
  return { kind: 'purchase', slices }
}

async function applySlices({
  ledgerEntry,
  slices,
  matchAccountId,
  side,
  counterAccountId,
  Ledger,
  session,
  writeOpts,
}) {
  const primary = slices.find((slice) => slice.accountId === matchAccountId)
  if (!primary || slices.length < 2) return false

  ledgerEntry.amount = primary.amount
  if (typeof ledgerEntry.save === 'function') {
    await ledgerEntry.save(typeof writeOpts === 'function' ? writeOpts(session) : undefined)
  }

  const extras = slices.filter((slice) => slice !== primary)
  await Ledger.create(extras.map((slice) => ({
    date: ledgerEntry.date,
    debitAccountId: side === 'debit' ? slice.accountId : counterAccountId,
    creditAccountId: side === 'credit' ? slice.accountId : counterAccountId,
    amount: slice.amount,
    description: ledgerEntry.description,
    referenceType: ledgerEntry.referenceType,
    referenceId: ledgerEntry.referenceId,
    createdBy: ledgerEntry.createdBy,
    updatedBy: ledgerEntry.updatedBy,
    department: ledgerEntry.department || '',
    currency: ledgerEntry.currency,
    exchangeRate: ledgerEntry.exchangeRate || 1,
    notes: `Split to ${slice.accountCode || slice.accountId}`,
  })), typeof writeOpts === 'function' ? writeOpts(session) : undefined)

  return true
}

async function applyVoucherLedgerSplit({
  tx,
  ledgerEntry,
  inventoryPlans,
  resolveAccountId,
  Ledger,
  session = null,
  writeOpts,
}) {
  if (!tx || !ledgerEntry || typeof Ledger?.create !== 'function') return false
  const type = String(tx.type || '').toLowerCase()
  const mainAmount = Number(ledgerEntry.amount || 0)
  if (!(mainAmount > 0)) return false

  if (type === 'purchase') {
    const plan = planPurchaseInventorySplit({ plans: inventoryPlans, mainAmount })
    if (!plan) return false
    return applySlices({
      ledgerEntry,
      slices: plan.slices,
      matchAccountId: String(ledgerEntry.debitAccountId?._id || ledgerEntry.debitAccountId || ''),
      side: 'debit',
      counterAccountId: ledgerEntry.creditAccountId?._id || ledgerEntry.creditAccountId,
      Ledger,
      session,
      writeOpts,
    })
  }

  if (type !== 'receipt' && type !== 'payment') return false

  const plan = planSettlementSplit({
    type,
    lines: tx?.voucherMeta?.lineItems,
    exchangeRate: Number(tx.exchangeRate || 1),
    mainAmount,
  })
  if (!plan || typeof resolveAccountId !== 'function') return false

  const slices = []
  for (const slice of plan.slices) {
    const accountId = await resolveAccountId(slice.accountCode)
    if (!accountId) return false
    slices.push({ ...slice, accountId: String(accountId) })
  }

  const side = type === 'receipt' ? 'debit' : 'credit'
  const matchAccountId = String(
    side === 'debit'
      ? (ledgerEntry.debitAccountId?._id || ledgerEntry.debitAccountId || '')
      : (ledgerEntry.creditAccountId?._id || ledgerEntry.creditAccountId || '')
  )
  const counterAccountId = side === 'debit'
    ? (ledgerEntry.creditAccountId?._id || ledgerEntry.creditAccountId)
    : (ledgerEntry.debitAccountId?._id || ledgerEntry.debitAccountId)

  return applySlices({
    ledgerEntry,
    slices,
    matchAccountId,
    side,
    counterAccountId,
    Ledger,
    session,
    writeOpts,
  })
}

module.exports = {
  planSettlementSplit,
  planPurchaseInventorySplit,
  applyVoucherLedgerSplit,
}
