import type { MarginRow } from '@/src/api/dashboard'
import { computeMarginMetricsRaw } from '@/src/utils/metalMarginPolicy'

export type MappedMarginRow = {
  name: string
  equity: number
  marginPercent: number
  goldPosition: number
  silverPosition: number
}

export function mapMarginRow(
  row: MarginRow,
  nameKey: 'customerName' | 'supplierName',
  options: {
    favorableCredit?: boolean
    goldPriceUSD?: number
    silverPriceUSD?: number
    liveRecalcEnabled?: boolean
  } = {},
): MappedMarginRow {
  const goldPosition = Number(row?.goldPosition || 0)
  const silverPosition = Number(row?.silverPosition || 0)
  let rawNet = Number(row?.equity ?? row?.netCashFlow ?? 0)
  let marginAmount = Number(row?.marginAmount || 0)
  let marginPercent = row?.marginPercent

  const goldPriceUSD = Number(options.goldPriceUSD || 0)
  const silverPriceUSD = Number(options.silverPriceUSD || 0)
  const liveRecalcEnabled = Boolean(options.liveRecalcEnabled)

  if (liveRecalcEnabled && (goldPriceUSD > 0 || silverPriceUSD > 0)) {
    const frozenEquity = Number(row?.equity ?? row?.netCashFlow ?? 0)
    const frozenReval = Number(row?.marginRevaluation ?? 0)
    const totalFunds = frozenEquity - frozenReval
    const metrics = computeMarginMetricsRaw({
      totalFunds,
      goldPosition,
      silverPosition,
      goldPrice: goldPriceUSD,
      silverPrice: silverPriceUSD,
      fundsMode: options.favorableCredit ? 'customerAbsIfNegative' : 'asIs',
    })
    rawNet = metrics.equity
    marginAmount = metrics.margin
    marginPercent = metrics.marginPercent
  }

  const net = options.favorableCredit && rawNet < 0 ? Math.abs(rawNet) : rawNet
  const rawMargin = marginPercent ?? row?.marginPercent
  const resolvedMarginPercent = Number.isFinite(Number(rawMargin))
    ? Number(rawMargin)
    : marginAmount > 0
      ? (Math.abs(net) / marginAmount) * 100
      : 0

  return {
    name: String(row?.[nameKey] || row?.name || '-'),
    equity: net,
    marginPercent: resolvedMarginPercent,
    goldPosition,
    silverPosition,
  }
}
