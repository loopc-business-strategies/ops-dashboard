import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { DashboardPayload } from '@/src/api/dashboard'
import { mgBranding } from '@/src/config/branding'
import { fmtMoney } from '@/src/utils/format'
import { widgetStyles } from '@/src/components/dashboard/widgetStyles'

export function AparWidget({ dashboard }: { dashboard: DashboardPayload | null }) {
  const [tab, setTab] = useState<'ar' | 'ap'>('ar')
  const ap = dashboard?.apAr || {}
  const arRows = ap.customerOutstanding || []
  const apRows = ap.supplierOutstanding || []
  const rows = tab === 'ar' ? arRows : apRows
  const netPosition = Number(ap.netPosition || 0)
  const netFavorable = netPosition >= 0

  return (
    <View>
      <View style={widgetStyles.statGrid}>
        {[
          { label: 'RECEIVABLE (AR)', val: ap.totalAR, sub: `${ap.arCount || 0} open`, bg: '#DCFCE7', color: '#16A34A' },
          { label: 'PAYABLE (AP)', val: ap.totalAP, sub: `${ap.apCount || 0} pending`, bg: '#FEE2E2', color: '#DC2626' },
          {
            label: 'NET POSITION',
            val: ap.netPosition,
            sub: netFavorable ? 'Favorable' : 'Deficit',
            bg: netFavorable ? '#E8F5EF' : '#FEE2E2',
            color: netFavorable ? mgBranding.colors.success : mgBranding.colors.danger,
          },
        ].map((item) => (
          <View key={item.label} style={[widgetStyles.statBox, { backgroundColor: item.bg, minWidth: '30%' }]}>
            <Text style={widgetStyles.statLabel}>{item.label}</Text>
            <Text style={[widgetStyles.statValue, { color: item.color }]}>{fmtMoney(item.val)}</Text>
            <Text style={[widgetStyles.statSub, { color: item.color }]}>{item.sub}</Text>
          </View>
        ))}
      </View>

      <View style={widgetStyles.tabRow}>
        {(['ar', 'ap'] as const).map((key) => (
          <Pressable
            key={key}
            style={[widgetStyles.tab, tab === key && widgetStyles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[widgetStyles.tabText, tab === key && widgetStyles.tabTextActive]}>
              {key === 'ar' ? 'Receivable (AR)' : 'Payable (AP)'}
            </Text>
          </Pressable>
        ))}
      </View>

      {rows.length === 0 ? (
        <Text style={widgetStyles.empty}>No outstanding balances.</Text>
      ) : (
        rows.slice(0, 6).map((row, i) => (
          <View key={`${row.customerName || row.supplierName}-${i}`} style={[widgetStyles.row, i === Math.min(rows.length, 6) - 1 && widgetStyles.rowLast]}>
            <Text style={widgetStyles.rowLabel} numberOfLines={1}>
              {row.customerName || row.supplierName || '—'}
            </Text>
            <Text
              style={[
                widgetStyles.rowValue,
                { color: tab === 'ar' ? '#16A34A' : '#DC2626' },
              ]}
            >
              {fmtMoney(row.outstanding)}
            </Text>
          </View>
        ))
      )}
    </View>
  )
}
