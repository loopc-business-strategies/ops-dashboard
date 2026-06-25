import { computeMarginMetricsRaw } from '../metalMarginPolicy'

/**
 * Live Account Summary metrics (gram USD spot × position).
 * Creditor/vendor suppress: frozen booked unfixed revaluation when provided.
 */
export function buildAccountEnquiryLiveMetrics({
  totalFunds = 0,
  goldPosition = 0,
  silverPosition = 0,
  goldPriceUSD = 0,
  silverPriceUSD = 0,
  suppressMetalSpotMtm = false,
  bookedRevaluation = null,
  liveRecalcEnabled = false,
} = {}) {
  if (!liveRecalcEnabled) return null

  const bookedTotal = Number(bookedRevaluation)
  const hasBookedOverride = suppressMetalSpotMtm
    && Number.isFinite(bookedTotal)
    && Math.abs(bookedTotal) > 0.000001

  return computeMarginMetricsRaw({
    totalFunds,
    goldPosition,
    silverPosition,
    goldPrice: goldPriceUSD,
    silverPrice: silverPriceUSD,
    suppressMetalSpotMtm: hasBookedOverride,
    revaluationOverride: hasBookedOverride ? bookedTotal : null,
    fundsMode: 'asIs',
  })
}

export function hasAccountEnquiryMetalExposure(goldPosition = 0, silverPosition = 0) {
  return Math.abs(Number(goldPosition || 0)) > 0.000001
    || Math.abs(Number(silverPosition || 0)) > 0.000001
}

export function resolveAccountEnquiryBookedRevaluation(metals = {}, statementBookedTotal = 0) {
  const apiTotal = Number(metals?.bookedUnfixedRevaluation?.total)
  if (Number.isFinite(apiTotal) && Math.abs(apiTotal) > 0.000001) return apiTotal
  const statementTotal = Number(statementBookedTotal || 0)
  if (Number.isFinite(statementTotal) && Math.abs(statementTotal) > 0.000001) return statementTotal
  return null
}
