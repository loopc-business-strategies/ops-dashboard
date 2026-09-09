import { computeMarginMetricsRaw } from '@/src/utils/metalMarginPolicy'

export function calculateAccountSummaryMetrics({
  totalFunds = 0,
  revaluation = 0,
  marginAmount = 0,
} = {}) {
  const signedFunds = Number(totalFunds || 0)
  const revaluationValue = Number(revaluation || 0)
  const marginValue = Math.abs(Number(marginAmount || 0))
  const fundsExposure = Math.abs(signedFunds)
  const netEquity = signedFunds + revaluationValue
  const excess = netEquity - marginValue
  const marginPercent = marginValue > 0 ? (fundsExposure / marginValue) * 100 : 0

  return {
    fundsExposure,
    netEquity,
    excess,
    marginPercent,
  }
}

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
  bookedRevaluation = null as number | null,
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

export function resolveAccountEnquiryBookedRevaluation(
  metals: { bookedUnfixedRevaluation?: { total?: number } } = {},
  statementBookedTotal = 0,
) {
  const apiTotal = Number(metals?.bookedUnfixedRevaluation?.total)
  if (Number.isFinite(apiTotal) && Math.abs(apiTotal) > 0.000001) return apiTotal
  const statementTotal = Number(statementBookedTotal || 0)
  if (Number.isFinite(statementTotal) && Math.abs(statementTotal) > 0.000001) return statementTotal
  return null
}

type StatementEntry = {
  metalFixStatus?: string
  metalSignedWeight?: number
  metalCode?: string
  isMetalTrade?: boolean
  description?: string
}

function resolveFixStatus(entry: StatementEntry) {
  const explicit = String(entry?.metalFixStatus || '').trim().toLowerCase()
  if (explicit === 'fixed' || explicit === 'unfixed') return explicit
  const text = String(entry?.description || '').toLowerCase()
  if (/non[\s-_]?fix|unfix|unfixed/.test(text)) return 'unfixed'
  if (/fixing|fixed|price[\s-_]?fix/.test(text)) return 'fixed'
  return 'unknown'
}

function resolveMetalCode(entry: StatementEntry) {
  const code = String(entry?.metalCode || '').trim().toUpperCase()
  if (code === 'XAU' || code === 'XAG') return code
  const text = String(entry?.description || '').toLowerCase()
  if (/\bxag\b|silver/.test(text)) return 'XAG'
  if (/\bxau\b|gold/.test(text)) return 'XAU'
  return ''
}

export function deriveEnquiryMetalBalances(
  metals?: { goldBalance?: number; silverBalance?: number },
  statementEntries: StatementEntry[] = [],
) {
  const apiGold = Number(metals?.goldBalance || 0)
  const apiSilver = Number(metals?.silverBalance || 0)

  const fromStatement = statementEntries.reduce(
    (acc, entry) => {
      if (resolveFixStatus(entry) !== 'unfixed') return acc
      const w = Number(entry.metalSignedWeight || 0)
      if (!Number.isFinite(w) || w === 0) return acc
      const isMetal = entry.isMetalTrade || resolveMetalCode(entry) !== ''
      if (!isMetal) return acc
      const mc = resolveMetalCode(entry)
      if (mc === 'XAG') acc.silver += w
      else if (mc) acc.gold += w
      return acc
    },
    { gold: 0, silver: 0 },
  )

  return {
    gold: apiGold !== 0 ? apiGold : fromStatement.gold,
    silver: apiSilver !== 0 ? apiSilver : fromStatement.silver,
  }
}
