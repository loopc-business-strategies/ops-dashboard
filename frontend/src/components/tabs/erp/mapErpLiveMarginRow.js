import { computeMarginMetricsRaw } from './metalMarginPolicy'

function fmtSigned(val) {
  const n = Number(val || 0)
  const formatted = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n > 0) return `+${formatted}`
  if (n < 0) return `-${formatted}`
  return formatted
}

function fmtMoney(val) {
  const n = Number(val || 0)
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPosition(val) {
  return Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

/**
 * Map a dashboard margin API row with optional live spot MTM recalc.
 * Mirrors mobile marginWidgetHelpers + metalMarginPolicy suppression rules.
 */
export function mapErpLiveMarginRow(row, nameKey, options = {}) {
  const goldPosition = Number(row?.goldPosition || 0)
  const silverPosition = Number(row?.silverPosition || 0)
  let rawNet = Number(row?.equity ?? row?.netCashFlow ?? 0)
  let marginAmount = Number(row?.marginAmount || 0)
  let rawExcess = Number(row?.marginExcess ?? (rawNet - marginAmount))
  let marginPercent = row?.marginPercent

  const goldPriceUSD = Number(options.goldPriceUSD || 0)
  const silverPriceUSD = Number(options.silverPriceUSD || 0)
  const marginLiveRecalc = Boolean(options.marginLiveRecalc)

  if (marginLiveRecalc && (goldPriceUSD > 0 || silverPriceUSD > 0)) {
    const frozenEquity = Number(row?.equity ?? row?.netCashFlow ?? 0)
    const frozenReval = Number(row?.marginRevaluation ?? 0)
    const totalFunds = frozenEquity - frozenReval
    const suppressMetalSpotMtm = Boolean(options.suppressMetalSpotMtm ?? row?.suppressMetalSpotMtm)
    const metrics = computeMarginMetricsRaw({
      totalFunds,
      goldPosition,
      silverPosition,
      goldPrice: goldPriceUSD,
      silverPrice: silverPriceUSD,
      suppressMetalSpotMtm,
      revaluationOverride: suppressMetalSpotMtm ? frozenReval : null,
      fundsMode: options.favorableCredit ? 'customerAbsIfNegative' : 'asIs',
    })
    rawNet = metrics.equity
    marginAmount = metrics.margin
    rawExcess = metrics.excess
    marginPercent = metrics.marginPercent
  }

  const net = options.favorableCredit && rawNet < 0 ? Math.abs(rawNet) : rawNet
  const excess = options.favorableCredit && rawExcess < 0 ? Math.abs(rawExcess) : rawExcess
  const status = String(row?.status || (net > 0 ? 'POSITIVE' : net < 0 ? 'NEGATIVE' : 'NEUTRAL')).toUpperCase()
  const rawMargin = marginPercent ?? row?.marginPercent
  marginPercent = Number.isFinite(Number(rawMargin)) ? Number(rawMargin) : (marginAmount > 0 ? (Math.abs(net) / marginAmount) * 100 : 0)

  return {
    name: String(row?.[nameKey] || row?.name || '-'),
    equity: net,
    equityFmt: fmtSigned(net),
    status,
    marginAmount,
    marginAmountFmt: fmtMoney(marginAmount),
    excess,
    excessFmt: fmtSigned(excess),
    goldPosition,
    silverPosition,
    marginFmt: Number.isFinite(marginPercent) ? `${Number(marginPercent).toFixed(2)} %` : '—',
    marginPercent,
  }
}

export { fmtPosition, fmtMoney, fmtSigned }
