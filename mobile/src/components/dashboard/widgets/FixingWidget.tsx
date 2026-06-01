import { Text, View } from 'react-native'
import type { DashboardPayload } from '@/src/api/dashboard'
import { mgBranding } from '@/src/config/branding'
import { widgetStyles } from '@/src/components/dashboard/widgetStyles'

function normaliseMetalCode(position: { code?: string; metal?: string }) {
  const raw = String(position.code || position.metal || '').trim().toUpperCase()
  if (raw.includes('XAU') || raw.includes('GOLD')) return 'XAU'
  if (raw.includes('XAG') || raw.includes('SILV')) return 'XAG'
  if (raw.includes('XPT') || raw.includes('PLAT')) return 'XPT'
  if (raw.includes('XPD') || raw.includes('PALL')) return 'XPD'
  return raw
}

function fmtFixing(n: number, unit: string) {
  const rounded = Math.abs(n) < 0.0005 ? 0 : n
  if (Math.abs(rounded) < 0.0005) return `0.000 ${unit}`
  const abs = Math.abs(rounded).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 4 })
  const sign = rounded > 0 ? '+' : '-'
  return `${sign}${abs} ${unit}`
}

export function FixingWidget({ dashboard }: { dashboard: DashboardPayload | null }) {
  const positions = Array.isArray(dashboard?.fixingPositions) ? dashboard.fixingPositions : []
  const byMetal = new Map(
    positions
      .map((p) => [normaliseMetalCode(p), p] as const)
      .filter(([code]) => ['XAU', 'XAG', 'XPT', 'XPD'].includes(code)),
  )
  const rows = [
    { code: 'XAU', title: 'Gold' },
    { code: 'XAG', title: 'Silver' },
    { code: 'XPT', title: 'Platinum' },
    { code: 'XPD', title: 'Palladium' },
  ].map((row) => {
    const p = byMetal.get(row.code) || {}
    const net = Number(p.netPosition ?? p.qty ?? 0)
    const unit = String(p.unit || 'GOZ').toUpperCase()
    return { ...row, net, unit, formatted: fmtFixing(net, unit) }
  })

  return (
    <View>
      {rows.map((row, i) => (
        <View key={row.code} style={[widgetStyles.row, i === rows.length - 1 && widgetStyles.rowLast]}>
          <View style={{ flex: 1 }}>
            <Text style={widgetStyles.rowLabel}>{row.title}</Text>
            <Text style={widgetStyles.rowSub}>{row.code}</Text>
          </View>
          <Text
            style={[
              widgetStyles.rowValue,
              { color: row.net > 0 ? mgBranding.colors.success : row.net < 0 ? mgBranding.colors.danger : mgBranding.colors.text },
            ]}
          >
            {row.formatted}
          </Text>
        </View>
      ))}
    </View>
  )
}
