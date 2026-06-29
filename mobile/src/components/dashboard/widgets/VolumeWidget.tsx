import { Text, View } from 'react-native'
import type { DashboardPayload } from '@/src/api/dashboard'
import { useTenantBranding } from '@/src/context/TenantContext'
import { fmtMoney } from '@/src/utils/format'
import { useWidgetStyles } from '@/src/components/dashboard/widgetStyles'

const VOL_COLORS = ['#F59E0B', '#9CA3AF', '#6366F1', '#EC4899', '#059669']

export function VolumeWidget({ dashboard }: { dashboard: DashboardPayload | null }) {
  const widgetStyles = useWidgetStyles()
  const { branding } = useTenantBranding()
  const vols = dashboard?.volumeTraded || []
  const totalQty = vols.reduce((s, v) => s + Number(v.qty || 0), 0)
  const mx = Math.max(...vols.map((v) => Number(v.qty || 0)), 1)

  if (vols.length === 0) {
    return <Text style={widgetStyles.empty}>No volume data in period.</Text>
  }

  return (
    <View>
      <View style={widgetStyles.barRow}>
        {vols.map((v, i) => {
          const qty = Number(v.qty || 0)
          const h = Math.max((qty / mx) * 44, 3)
          return (
            <View key={`${v.metal}-${i}`} style={widgetStyles.barCol}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: branding.colors.success, marginBottom: 2 }}>
                {qty.toFixed(0)}
              </Text>
              <View style={[widgetStyles.bar, { height: h, backgroundColor: VOL_COLORS[i % VOL_COLORS.length] }]} />
              <Text style={widgetStyles.barLabel}>{(v.metal || '').slice(0, 4)}</Text>
            </View>
          )
        })}
      </View>

      {vols.map((v, i) => (
        <View key={`row-${v.metal}-${i}`} style={[widgetStyles.row, i === vols.length - 1 && widgetStyles.rowLast]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: VOL_COLORS[i % VOL_COLORS.length] }} />
            <Text style={widgetStyles.rowLabel}>{v.metal || 'Metal'}</Text>
          </View>
          <Text style={[widgetStyles.rowValue, { marginRight: 10 }]}>{Number(v.qty || 0).toLocaleString()} oz</Text>
          <Text style={widgetStyles.rowValue}>{fmtMoney(v.value)}</Text>
        </View>
      ))}

      <View style={widgetStyles.footerTotal}>
        <Text style={widgetStyles.footerTotalLabel}>Total</Text>
        <Text style={widgetStyles.footerTotalValue}>{totalQty.toLocaleString()} oz</Text>
      </View>
    </View>
  )
}
