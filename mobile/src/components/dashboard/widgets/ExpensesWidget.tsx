import { Text, View } from 'react-native'
import type { DashboardPayload } from '@/src/api/dashboard'
import { useTenantBranding } from '@/src/context/TenantContext'
import { fmtCompactCurrency, fmtMoney } from '@/src/utils/format'
import { useWidgetStyles } from '@/src/components/dashboard/widgetStyles'

const COLORS = ['#059669', '#2563EB', '#D97706', '#7C3AED', '#DC2626', '#0891B2']

export function ExpensesWidget({ dashboard }: { dashboard: DashboardPayload | null }) {
  const widgetStyles = useWidgetStyles()
  const { branding } = useTenantBranding()
  const exp = dashboard?.expenses || {}
  const total = Number(exp.total || 0)
  const ytdTotal = Number(exp.ytdTotal || 0)
  const currentTotal = Number(exp.currentMonthTotal ?? total)
  const breakdown = exp.breakdown || []
  const displayTotal = total > 0 ? total : ytdTotal
  const segments = breakdown
    .filter((item) => Number(item.amount || 0) > 0)
    .slice(0, 5)
    .map((item, i) => ({
      label: item.name || item.label || item.month || 'Other',
      value: Number(item.amount || 0),
      color: COLORS[i % COLORS.length],
      pct: displayTotal > 0 ? (Number(item.amount || 0) / displayTotal) * 100 : 0,
    }))

  if (displayTotal <= 0 && segments.length === 0) {
    return <Text style={widgetStyles.empty}>No expenses in period.</Text>
  }

  return (
    <View>
      {segments.map((seg, i) => (
        <View key={`${seg.label}-${i}`} style={[widgetStyles.row, i === segments.length - 1 && segments.length < 2 && widgetStyles.rowLast]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: seg.color }} />
            <Text style={widgetStyles.rowLabel} numberOfLines={1}>{seg.label}</Text>
          </View>
          <Text style={widgetStyles.rowValue}>{seg.pct.toFixed(0)}%</Text>
        </View>
      ))}

      <View style={[widgetStyles.statGrid, { marginTop: 8 }]}>
        <View style={[widgetStyles.statBox, { borderWidth: 1, borderColor: '#E5E7EB', minWidth: '46%' }]}>
          <Text style={widgetStyles.statLabel}>THIS MONTH</Text>
          <Text style={[widgetStyles.statValue, { fontSize: 16 }]}>{fmtMoney(currentTotal)}</Text>
        </View>
        <View style={[widgetStyles.statBox, { borderWidth: 1, borderColor: '#E5E7EB', minWidth: '46%' }]}>
          <Text style={widgetStyles.statLabel}>THIS YEAR</Text>
          <Text style={[widgetStyles.statValue, { fontSize: 16, color: branding.colors.success }]}>
            {fmtMoney(ytdTotal)}
          </Text>
        </View>
      </View>

      {displayTotal > 0 ? (
        <Text style={widgetStyles.note}>Total breakdown: {fmtCompactCurrency(displayTotal)}</Text>
      ) : null}
    </View>
  )
}
