import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const shared = require('../../../shared/money.js')

export const toMoney = shared.toMoney
export const MONEY_TOL = 0.01
export const QTY_TOL = 0.000001

export function toQty(value) {
  return Number(Number(value || 0).toFixed(6))
}

export function baseAmount(amount, exchangeRate = 1) {
  return toMoney(Number(amount || 0) * Number(exchangeRate || 1))
}

export function moneyDiff(a, b) {
  return toMoney(Number(a || 0) - Number(b || 0))
}

export function withinMoneyTol(a, b, tol = MONEY_TOL) {
  return Math.abs(moneyDiff(a, b)) <= tol
}

export function withinQtyTol(a, b, tol = QTY_TOL) {
  return Math.abs(Number(a || 0) - Number(b || 0)) <= tol
}

export function resolvePurityRatio(purity) {
  const n = Number(purity || 0)
  if (!Number.isFinite(n) || n <= 0) return 0
  return n > 1.2 ? n / 1000 : n
}

export function resolveLinePureWeight(line = {}) {
  const pure = Number(line.pureWeight || 0)
  if (pure > 0) return toQty(pure)
  const gross = Number(line.grossWeight || 0)
  const ratio = resolvePurityRatio(line.purity)
  if (gross > 0 && ratio > 0) return toQty(gross * ratio)
  return 0
}

export function resolveLineInventoryQty(line = {}) {
  const gross = Number(line.grossWeight || 0)
  if (gross > 0) return toQty(gross)
  const pure = Number(line.pureWeight || 0)
  if (pure > 0) return toQty(pure)
  const oz = Number(line.weightInOz || 0)
  if (oz > 0) return toQty(oz * 31.1034768)
  const pcs = Number(line.pcs || 0)
  if (pcs > 0) return toQty(pcs)
  return 0
}

export function isMetalTransferType(type) {
  const t = String(type || '').toLowerCase()
  return t === 'metal_receipt' || t === 'metal_payment'
}

export function isUnfixed(tx) {
  const v = String(tx?.voucherMeta?.fixingType || tx?.metalFixStatus || '').trim().toLowerCase()
  return ['unfixed', 'non-fixing', 'non_fixing', 'nonfixing'].includes(v)
}
