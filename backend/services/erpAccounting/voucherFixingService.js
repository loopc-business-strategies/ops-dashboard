/**
 * Fixing of a posted unfixed sale/purchase voucher.
 *
 * A fixing prices some (or all) of the voucher's open grams on its own date:
 * it posts the metal value with the voucher's own debit/credit accounts and
 * records the fixed grams on the voucher, so positions only count open grams.
 * Stock is untouched (the metal moved when the voucher was posted) and the
 * voucher itself is not edited, so the 24-hour voucher lock does not apply.
 */

const mongoose = require('mongoose')
const {
  OZ_TO_GRAM,
  isUnfixedFixingType,
  listActiveVoucherFixings,
} = require('./metalPositionPolicy')
const { withSession, writeOpts } = require('../../utils/mongoTransaction')
const { roundMoney } = require('../../shared/money')

const FIXING_WEIGHT_EPSILON = 0.0005
const FIXING_RATE_TYPES = ['OZ', 'GRAM', 'KG']

function fixingError(message, status = 400, code = 'VOUCHER_FIXING_INVALID') {
  const err = new Error(message)
  err.status = status
  err.code = code
  return err
}

function roundGrams(value) {
  return Number(Number(value || 0).toFixed(6))
}

function resolveLinePureWeight(line = {}) {
  const explicit = Number(line?.pureWeight || 0)
  if (Number.isFinite(explicit) && explicit > 0) return explicit
  const gross = Number(line?.grossWeight || 0)
  const purity = Number(line?.purity || 0)
  const purityRatio = purity > 1.2 ? purity / 1000 : purity
  const derived = gross * purityRatio
  return Number.isFinite(derived) && derived > 0 ? derived : 0
}

function resolveFixingLineMetalCode(line = {}) {
  const stockCode = String(line?.stockCode || '').toUpperCase()
  return stockCode.includes('XAG') || stockCode.includes('SILV') ? 'XAG' : 'XAU'
}

function normalizeFixingRateType(value) {
  const normalized = String(value || 'OZ').trim().toUpperCase()
  if (normalized === 'G' || normalized === 'GM' || normalized === 'GRAMS') return 'GRAM'
  return FIXING_RATE_TYPES.includes(normalized) ? normalized : 'OZ'
}

function resolveFixingRateQuantity(pureWeight, rateType) {
  const grams = Number(pureWeight || 0)
  const type = normalizeFixingRateType(rateType)
  if (type === 'GRAM') return grams
  if (type === 'KG') return grams / 1000
  return grams / OZ_TO_GRAM
}

function computeVoucherFixingAmount({ pureWeight, rate, rateType, currency }) {
  const value = resolveFixingRateQuantity(pureWeight, rateType) * Number(rate || 0)
  return roundMoney(value, String(currency || 'USD').toUpperCase())
}

function summarizeVoucherFixingState(tx = {}) {
  const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
  const metalCodes = new Set()
  let totalWeight = 0
  for (const line of lines) {
    const grams = resolveLinePureWeight(line)
    if (grams <= 0) continue
    totalWeight += grams
    metalCodes.add(resolveFixingLineMetalCode(line))
  }
  const fixings = listActiveVoucherFixings(tx)
  const fixedWeight = fixings.reduce((sum, fixing) => sum + Number(fixing.pureWeight || 0), 0)
  const openWeight = Math.max(totalWeight - fixedWeight, 0)
  const firstPricedLine = lines.find((line) => resolveLinePureWeight(line) > 0) || lines[0] || {}
  return {
    isUnfixed: isUnfixedFixingType(tx?.voucherMeta?.fixingType || tx?.metalFixStatus),
    totalWeight: roundGrams(totalWeight),
    fixedWeight: roundGrams(fixedWeight),
    openWeight: openWeight < FIXING_WEIGHT_EPSILON ? 0 : roundGrams(openWeight),
    metalCode: metalCodes.size === 1 ? Array.from(metalCodes)[0] : '',
    mixedMetals: metalCodes.size > 1,
    rateType: normalizeFixingRateType(firstPricedLine.rateType),
    fixings,
  }
}

function calculateUnfixedPremiumAmount(lines = []) {
  return (Array.isArray(lines) ? lines : []).reduce((sum, line) => {
    const premiumVal = Number(line?.premiumValue || 0)
    if (!premiumVal) return sum
    const grams = resolveLinePureWeight(line) || (Number(line?.weightInOz || 0) * OZ_TO_GRAM)
    return sum + (premiumVal * resolveFixingRateQuantity(grams, line?.rateType))
  }, 0)
}

/**
 * Voucher amount still waiting for a price: premium stays booked, the metal
 * part shrinks with the open share of the grams (0 when fully fixed).
 */
function resolveOpenUnfixedVoucherAmount({ voucherAmount, premiumAmount = 0, totalWeight, openWeight }) {
  const amount = Number(voucherAmount || 0)
  const total = Number(totalWeight || 0)
  if (!(total > 0)) return amount
  const ratio = Math.min(Math.max(Number(openWeight || 0) / total, 0), 1)
  if (ratio <= 0) return 0
  if (ratio >= 1) return amount
  const premium = Math.abs(Number(premiumAmount || 0))
  return premium + (Math.max(amount - premium, 0) * ratio)
}

function assertVoucherFixable(tx, state) {
  if (!tx || tx.isDeleted) throw fixingError('Voucher not found', 404, 'VOUCHER_NOT_FOUND')
  const type = String(tx.type || '').toLowerCase()
  if (type !== 'sale' && type !== 'purchase') {
    throw fixingError('Only sale and purchase vouchers can be fixed')
  }
  if (tx.status !== 'posted') throw fixingError('Only posted vouchers can be fixed')
  if (!state.isUnfixed) throw fixingError('This voucher is already fixed')
  if (state.mixedMetals) throw fixingError('Vouchers with more than one metal cannot be fixed here')
  if (!(state.totalWeight > 0)) throw fixingError('This voucher has no pure weight to fix')
  if (!(state.openWeight > 0)) throw fixingError('This voucher has no unfixed grams left')
  if (!tx.debitAccountId || !tx.creditAccountId) {
    throw fixingError('Voucher posting accounts are missing; re-post the voucher before fixing')
  }
}

function createVoucherFixingService({
  Transaction,
  Ledger,
  Currency,
  BASE_CURRENCY_CODE,
  assertAccountingPeriodOpen,
  appendTransactionAudit,
}) {
  const assertPeriod = typeof assertAccountingPeriodOpen === 'function'
    ? assertAccountingPeriodOpen
    : async () => {}

  const loadVoucher = async (transactionId, session) => {
    if (!mongoose.Types.ObjectId.isValid(String(transactionId || ''))) {
      throw fixingError('Voucher not found', 404, 'VOUCHER_NOT_FOUND')
    }
    const tx = await withSession(Transaction.findById(transactionId), session)
    if (!tx || tx.isDeleted) throw fixingError('Voucher not found', 404, 'VOUCHER_NOT_FOUND')
    return tx
  }

  const resolveBaseCurrencyCode = async (session) => {
    const base = await withSession(
      Currency.findOne({ baseCurrency: true, isActive: true }).select('code').lean(),
      session,
    )
    return String(base?.code || BASE_CURRENCY_CODE || 'USD').toUpperCase()
  }

  async function addVoucherFixing({
    transactionId,
    user,
    tenant,
    date,
    pureWeight,
    rate,
    rateType,
    notes = '',
    session = null,
  }) {
    const tx = await loadVoucher(transactionId, session)
    const state = summarizeVoucherFixingState(tx)
    assertVoucherFixable(tx, state)

    const fixingDate = date ? new Date(date) : new Date()
    if (Number.isNaN(fixingDate.getTime())) throw fixingError('Invalid fixing date')

    const requestedWeight = pureWeight === undefined || pureWeight === null || pureWeight === ''
      ? state.openWeight
      : Number(pureWeight)
    if (!Number.isFinite(requestedWeight) || requestedWeight <= 0) {
      throw fixingError('Grams to fix must be greater than zero')
    }
    if (requestedWeight > state.openWeight + FIXING_WEIGHT_EPSILON) {
      throw fixingError(`Only ${state.openWeight} g is still unfixed on this voucher`)
    }
    const fixedWeight = roundGrams(Math.min(requestedWeight, state.openWeight))

    const fixingRate = Number(rate)
    if (!Number.isFinite(fixingRate) || fixingRate <= 0) {
      throw fixingError('Fixing rate must be greater than zero')
    }
    const fixingRateType = normalizeFixingRateType(rateType || state.rateType)
    const currency = String(tx.currency || BASE_CURRENCY_CODE || 'USD').toUpperCase()
    const amount = computeVoucherFixingAmount({
      pureWeight: fixedWeight,
      rate: fixingRate,
      rateType: fixingRateType,
      currency,
    })
    if (!(amount > 0)) throw fixingError('Fixing amount must be greater than zero')

    await assertPeriod({ tenant, date: fixingDate })

    const exchangeRateRaw = Number(tx.exchangeRate || 1)
    const exchangeRate = Number.isFinite(exchangeRateRaw) && exchangeRateRaw > 0 ? exchangeRateRaw : 1
    const baseCurrencyCode = await resolveBaseCurrencyCode(session)
    const vocNo = String(tx.voucherMeta?.vocNo || tx.voucherMeta?.refNo || tx._id)
    const fixingId = new mongoose.Types.ObjectId()
    const description = `Fixing of ${vocNo}: ${fixedWeight} g @ ${fixingRate} ${currency}/${fixingRateType}`

    const ledgerEntry = await Ledger.create([{
      date: fixingDate,
      debitAccountId: tx.debitAccountId,
      creditAccountId: tx.creditAccountId,
      amount: roundMoney(amount * exchangeRate, baseCurrencyCode),
      description,
      referenceType: 'voucher_fixing',
      referenceId: fixingId,
      createdBy: user._id,
      updatedBy: user._id,
      department: user.department || tx.department || '',
      currency: baseCurrencyCode,
      exchangeRate: 1,
      notes: String(notes || '').trim(),
    }], writeOpts(session)).then((rows) => rows[0])

    if (!tx.voucherMeta) tx.voucherMeta = {}
    if (!Array.isArray(tx.voucherMeta.fixings)) tx.voucherMeta.fixings = []
    tx.voucherMeta.fixings.push({
      _id: fixingId,
      date: fixingDate,
      pureWeight: fixedWeight,
      metalCode: state.metalCode || 'XAU',
      rate: fixingRate,
      rateType: fixingRateType,
      amount,
      currency,
      exchangeRate,
      ledgerEntryId: ledgerEntry._id,
      notes: String(notes || '').trim(),
      createdBy: user._id,
      createdAt: new Date(),
    })
    tx.updatedBy = user._id
    if (typeof appendTransactionAudit === 'function') {
      appendTransactionAudit(tx, user, 'fixing_added', {
        fromStatus: tx.status,
        toStatus: tx.status,
        comment: description,
      })
    }
    await tx.save(writeOpts(session))

    const fixing = tx.voucherMeta.fixings.id(fixingId)
    return { transaction: tx, fixing, ledgerEntry, state: summarizeVoucherFixingState(tx) }
  }

  async function removeVoucherFixing({
    transactionId,
    fixingId,
    user,
    tenant,
    reason = '',
    session = null,
  }) {
    const tx = await loadVoucher(transactionId, session)
    const fixings = Array.isArray(tx.voucherMeta?.fixings) ? tx.voucherMeta.fixings : []
    const fixing = fixings.find((row) => String(row._id) === String(fixingId))
    if (!fixing || fixing.isDeleted) throw fixingError('Fixing not found', 404, 'VOUCHER_FIXING_NOT_FOUND')

    await assertPeriod({
      tenant,
      date: fixing.date,
      existingDate: fixing.date,
      createdAt: fixing.createdAt,
    })

    const now = new Date()
    await Ledger.updateMany(
      { referenceType: 'voucher_fixing', referenceId: fixing._id, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: now, updatedBy: user._id } },
      writeOpts(session),
    )

    fixing.isDeleted = true
    fixing.deletedAt = now
    fixing.deletedBy = user._id
    fixing.deleteReason = String(reason || '').trim()
    tx.updatedBy = user._id
    if (typeof appendTransactionAudit === 'function') {
      appendTransactionAudit(tx, user, 'fixing_removed', {
        fromStatus: tx.status,
        toStatus: tx.status,
        comment: `Removed fixing of ${fixing.pureWeight} g @ ${fixing.rate}/${fixing.rateType}${reason ? ` — ${reason}` : ''}`,
      })
    }
    await tx.save(writeOpts(session))
    return { transaction: tx, fixing, state: summarizeVoucherFixingState(tx) }
  }

  return {
    addVoucherFixing,
    removeVoucherFixing,
  }
}

module.exports = {
  FIXING_WEIGHT_EPSILON,
  normalizeFixingRateType,
  resolveFixingRateQuantity,
  computeVoucherFixingAmount,
  summarizeVoucherFixingState,
  calculateUnfixedPremiumAmount,
  resolveOpenUnfixedVoucherAmount,
  assertVoucherFixable,
  createVoucherFixingService,
}
