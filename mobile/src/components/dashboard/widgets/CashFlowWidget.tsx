import { Text, View } from 'react-native'
import type { DashboardPayload } from '@/src/api/dashboard'
import { mgBranding } from '@/src/config/branding'
import { fmtMoney } from '@/src/utils/format'
import { widgetStyles } from '@/src/components/dashboard/widgetStyles'

export function CashFlowWidget({ dashboard }: { dashboard: DashboardPayload | null }) {
  const cf = dashboard?.cashFlow
  const monthly = cf?.monthly || []
  const getInflow = (row: { inflow?: number; cashIn?: number }) => Number(row?.inflow ?? row?.cashIn ?? 0)
  const getOutflow = (row: { outflow?: number; cashOut?: number }) => Number(row?.outflow ?? row?.cashOut ?? 0)
  const mx = Math.max(...monthly.map((m) => Math.max(getInflow(m), getOutflow(m))), 1)
  const activity = cf?.activity || {}
  const quality = cf?.quality || {}

  const summaryItems = [
    { label: 'Inflow', val: cf?.inflow, bg: '#DCFCE7', color: mgBranding.colors.success },
    { label: 'Outflow', val: cf?.outflow, bg: '#FEE2E2', color: mgBranding.colors.danger },
    {
      label: 'Net',
      val: cf?.net,
      bg: '#E8F5EF',
      color: Number(cf?.net || 0) >= 0 ? mgBranding.colors.success : mgBranding.colors.danger,
    },
  ]

  return (
    <View>
      {monthly.length > 0 ? (
        <View style={widgetStyles.barRow}>
          {monthly.slice(-6).map((m, i) => {
            const inH = Math.max((getInflow(m) / mx) * 48, 3)
            const outH = Math.max((getOutflow(m) / mx) * 48, 3)
            return (
              <View key={`${m.month}-${i}`} style={widgetStyles.barCol}>
                <View style={{ flexDirection: 'row', gap: 1, alignItems: 'flex-end', height: 48 }}>
                  <View style={[widgetStyles.bar, { height: inH, backgroundColor: '#22C97E', flex: 1 }]} />
                  <View style={[widgetStyles.bar, { height: outH, backgroundColor: '#FCA5A5', flex: 1 }]} />
                </View>
                <Text style={widgetStyles.barLabel} numberOfLines={1}>{m.month || ''}</Text>
              </View>
            )
          })}
        </View>
      ) : null}

      <View style={widgetStyles.statGrid}>
        {summaryItems.map((item) => (
          <View key={item.label} style={[widgetStyles.statBox, { backgroundColor: item.bg }]}>
            <Text style={widgetStyles.statLabel}>{item.label}</Text>
            <Text style={[widgetStyles.statValue, { color: item.color }]}>{fmtMoney(item.val)}</Text>
          </View>
        ))}
      </View>

      <View style={widgetStyles.statGrid}>
        {[
          { label: 'Operating', val: Number(activity?.operating?.net || 0) },
          { label: 'Investing', val: Number(activity?.investing?.net || 0) },
          { label: 'Financing', val: Number(activity?.financing?.net || 0) },
        ].map((item) => (
          <View key={item.label} style={[widgetStyles.statBox, { borderWidth: 1, borderColor: '#E5E7EB' }]}>
            <Text style={widgetStyles.statLabel}>{item.label}</Text>
            <Text
              style={[
                widgetStyles.statValue,
                { fontSize: 12, color: item.val >= 0 ? mgBranding.colors.success : mgBranding.colors.danger },
              ]}
            >
              {fmtMoney(item.val)}
            </Text>
          </View>
        ))}
      </View>

      <Text style={widgetStyles.note}>
        Runway: {quality?.runwayMonths == null ? '—' : `${Number(quality.runwayMonths).toFixed(1)} mo`} | Coverage:{' '}
        {quality?.operatingCoverage == null ? '—' : `${Number(quality.operatingCoverage).toFixed(2)}x`}
      </Text>
    </View>
  )
}
