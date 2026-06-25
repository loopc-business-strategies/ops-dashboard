/**
 * Mirrors backend/services/erpAccounting/metalMarginPolicy.js
 * Keep behaviour in sync with backend/tests/metalMarginPolicy.test.js
 */

export function shouldSuppressSpotMetalMtmForCustomerDashboard(accountType?: string) {
  return String(accountType || '').trim().toLowerCase() === 'liability'
}

/** Supplier / vendor margin: AP in currency; gram positions are informational only. */
export function shouldSuppressSpotMetalMtmForSupplierDashboard() {
  return true
}

export function computeMarginMetricsRaw({
  totalFunds,
  goldPosition,
  silverPosition,
  goldPrice,
  silverPrice,
  suppressMetalSpotMtm = false,
  revaluationOverride = null as number | string | null,
  fundsMode = 'asIs' as 'asIs' | 'customerAbsIfNegative',
}: {
  totalFunds?: number | string
  goldPosition?: number | string
  silverPosition?: number | string
  goldPrice?: number | string
  silverPrice?: number | string
  suppressMetalSpotMtm?: boolean
  revaluationOverride?: number | string | null
  fundsMode?: 'asIs' | 'customerAbsIfNegative'
}) {
  const rawFunds = Number(totalFunds || 0)
  const funds = fundsMode === 'customerAbsIfNegative' && rawFunds < 0 ? Math.abs(rawFunds) : rawFunds

  let revaluation: number
  if (revaluationOverride !== null && revaluationOverride !== undefined) {
    revaluation = Number(revaluationOverride || 0)
  } else if (suppressMetalSpotMtm) {
    revaluation = 0
  } else {
    revaluation =
      Number(goldPosition || 0) * Number(goldPrice || 0) + Number(silverPosition || 0) * Number(silverPrice || 0)
  }

  const margin = Math.abs(revaluation) * 0.02
  const equity = funds + revaluation
  const excess = equity - margin
  const marginPercent = margin > 0 ? (Math.abs(funds) / margin) * 100 : 0
  const status = equity > 0 ? 'POSITIVE' : equity < 0 ? 'NEGATIVE' : 'NEUTRAL'

  return {
    funds,
    revaluation,
    margin,
    equity,
    excess,
    marginPercent,
    status,
  }
}
