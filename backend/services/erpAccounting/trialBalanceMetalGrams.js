const { linePureWeight } = require('../../utils/metalStockVoucherTypes')
const { buildMetalMatchers } = require('./fixingRegisterReport')

const METAL_TRIAL_TYPES = ['purchase', 'sale', 'metal_receipt', 'metal_payment']
const GRAM_EPS = 0.0005

/** Kinds that Trial Balance / Summary expose as gram columns. */
const METAL_KINDS = ['gold', 'silver', 'platinum', 'alloy']

const KIND_TO_METAL_CODE = {
  gold: 'XAU',
  silver: 'XAG',
  platinum: 'XPT',
  alloy: 'ALLOY',
}

const emptyMetalGrams = () => ({
  goldDebit: 0,
  goldCredit: 0,
  goldOpening: 0,
  silverDebit: 0,
  silverCredit: 0,
  silverOpening: 0,
  platinumDebit: 0,
  platinumCredit: 0,
  platinumOpening: 0,
  alloyDebit: 0,
  alloyCredit: 0,
  alloyOpening: 0,
})

const roundGrams = (value) => Number(Number(value || 0).toFixed(3))

function lineMetalKind(line = {}) {
  const stock = String(line?.stockCode || '').trim().toUpperCase()
  const product = `${String(line?.productType || '')} ${String(line?.narration || '')}`.toLowerCase()
  if (stock === 'XAG' || stock.includes('SILV') || product.includes('silver') || product.includes('xag')) return 'silver'
  if (stock === 'XPT' || stock.includes('PLAT') || product.includes('platinum') || product.includes('xpt')) return 'platinum'
  if (stock === 'ALLOY' || stock.includes('ALLO') || product.includes('alloy')) return 'alloy'
  if (stock === 'XAU' || stock.includes('GOLD') || product.includes('gold') || product.includes('xau')) return 'gold'
  return ''
}

/** Sale and metal payment debit the party. Purchase and metal receipt credit the party. */
function signedPartyGrams(type, grams) {
  const weight = Number(grams || 0)
  if (!Number.isFinite(weight) || weight <= 0) return 0
  const normalized = String(type || '').trim().toLowerCase()
  if (normalized === 'sale' || normalized === 'metal_payment') return weight
  if (normalized === 'purchase' || normalized === 'metal_receipt') return -weight
  return 0
}

function resolvePartyAccountId(tx, accountsById, accountsByCode) {
  const partyId = String(tx?.voucherMeta?.partyAccountId || '').trim()
  if (partyId && accountsById.has(partyId)) return partyId
  const rawCode = String(tx?.voucherMeta?.partyCode || '').trim()
  if (!rawCode) return ''
  if (accountsByCode.has(rawCode)) return accountsByCode.get(rawCode)
  const leading = rawCode.split(/\s|-/)[0]
  if (leading && accountsByCode.has(leading)) return accountsByCode.get(leading)
  return ''
}

function addSignedGrams(bucket, kind, signed, { opening = false } = {}) {
  if (!signed || !METAL_KINDS.includes(kind)) return
  if (opening) {
    bucket[`${kind}Opening`] += signed
    return
  }
  if (signed > 0) {
    bucket[`${kind}Debit`] += signed
  } else {
    bucket[`${kind}Credit`] += Math.abs(signed)
  }
}

function metalNet(opening, debit, credit) {
  return roundGrams(Number(opening || 0) + Number(debit || 0) - Number(credit || 0))
}

function presentMetalGrams(bucket = emptyMetalGrams()) {
  const source = bucket || emptyMetalGrams()
  const out = {}
  for (const kind of METAL_KINDS) {
    out[`${kind}Debit`] = roundGrams(source[`${kind}Debit`])
    out[`${kind}Credit`] = roundGrams(source[`${kind}Credit`])
    out[`${kind}Net`] = metalNet(source[`${kind}Opening`], source[`${kind}Debit`], source[`${kind}Credit`])
  }
  return out
}

function hasMetalGrams(row = {}) {
  return METAL_KINDS.some((kind) => (
    Math.abs(Number(row[`${kind}Net`] || 0)) > GRAM_EPS
    || Math.abs(Number(row[`${kind}Debit`] || 0)) > GRAM_EPS
    || Math.abs(Number(row[`${kind}Credit`] || 0)) > GRAM_EPS
  ))
}

/**
 * Party-account pure grams for posted purchase, sale, metal receipt, and metal payment.
 * Grams before startDate sit in the opening net. Cash and other accounts stay at zero.
 */
function accumulateTrialMetalGrams(transactions = [], {
  accountsById = new Map(),
  accountsByCode = new Map(),
  startDate = null,
  endDate = null,
  excludeHedging = false,
  metalType = '',
} = {}) {
  const totals = new Map()
  const startMs = startDate ? new Date(startDate).getTime() : null
  const endMs = endDate ? new Date(endDate).getTime() : null
  const { matchesSelectedMetal, isAllMetalSelection } = buildMetalMatchers(metalType || 'ALL')
  for (const tx of transactions) {
    const type = String(tx?.type || '').trim().toLowerCase()
    if (!METAL_TRIAL_TYPES.includes(type)) continue
    if (excludeHedging && tx?.voucherMeta?.hedge) continue
    const when = tx?.date ? new Date(tx.date).getTime() : null
    if (endMs != null && when != null && when > endMs) continue
    const accountId = resolvePartyAccountId(tx, accountsById, accountsByCode)
    if (!accountId) continue
    const opening = startMs != null && when != null && when < startMs
    const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
    for (const line of lines) {
      const kind = lineMetalKind(line)
      const signed = signedPartyGrams(type, linePureWeight(line))
      if (!signed || !kind) continue
      if (!isAllMetalSelection) {
        const metalCode = KIND_TO_METAL_CODE[kind] || ''
        if (!matchesSelectedMetal(metalCode, line?.stockCode)) continue
      }
      const bucket = totals.get(accountId) || emptyMetalGrams()
      addSignedGrams(bucket, kind, signed, { opening })
      totals.set(accountId, bucket)
    }
  }
  return totals
}

module.exports = {
  METAL_TRIAL_TYPES,
  METAL_KINDS,
  KIND_TO_METAL_CODE,
  emptyMetalGrams,
  presentMetalGrams,
  hasMetalGrams,
  accumulateTrialMetalGrams,
  lineMetalKind,
  signedPartyGrams,
}
