import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { DashboardPayload } from '@/src/api/dashboard'
import { useTenant } from '@/src/context/TenantContext'
import { useErpLiveMetalSpotPrices } from '@/src/hooks/useErpLiveMetalSpotPrices'
import { fmtPosition, fmtSigned } from '@/src/utils/format'
import { mapMarginRow } from '@/src/utils/marginWidgetHelpers'
import { useWidgetStyles } from '@/src/components/dashboard/widgetStyles'

const MAX_ROWS = 5

type Props = {
  dashboard: DashboardPayload | null
  goldPriceUSD?: number
  silverPriceUSD?: number
  liveRecalcEnabled?: boolean
}

export function MarginsWidget({
  dashboard,
  goldPriceUSD: goldPriceProp,
  silverPriceUSD: silverPriceProp,
  liveRecalcEnabled: liveRecalcProp,
}: Props) {
  const [tab, setTab] = useState<'customers' | 'suppliers'>('customers')
  const widgetStyles = useWidgetStyles()
  const { branding } = useTenant()
  const liveSpot = useErpLiveMetalSpotPrices()
  const goldPriceUSD = goldPriceProp ?? liveSpot.goldPriceUSD
  const silverPriceUSD = silverPriceProp ?? liveSpot.silverPriceUSD
  const liveRecalcEnabled = liveRecalcProp ?? liveSpot.liveRecalcEnabled
  const recalcOptions = { goldPriceUSD, silverPriceUSD, liveRecalcEnabled }
  const customers = (dashboard?.customerMargins || []).map((r) =>
    mapMarginRow(r, 'customerName', { ...recalcOptions, favorableCredit: true }),
  )
  const suppliers = (dashboard?.supplierMargins?.rows || []).map((r) =>
    mapMarginRow(r, 'supplierName', { ...recalcOptions, suppressMetalSpotMtm: true }),
  )
  const rows = tab === 'suppliers' ? suppliers : customers

  return (
    <View>
      <View style={widgetStyles.tabRow}>
        {(['customers', 'suppliers'] as const).map((key) => (
          <Pressable
            key={key}
            style={[widgetStyles.tab, tab === key && widgetStyles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[widgetStyles.tabText, tab === key && widgetStyles.tabTextActive]}>
              {key === 'customers' ? 'Customers' : 'Suppliers'}
            </Text>
          </Pressable>
        ))}
      </View>
      {rows.length === 0 ? (
        <Text style={widgetStyles.empty}>No {tab === 'suppliers' ? 'supplier' : 'customer'} data available.</Text>
      ) : (
        <>
          <View style={widgetStyles.headerRow}>
            <Text style={[widgetStyles.headerCell, { flex: 1.4 }]}>Name</Text>
            <Text style={[widgetStyles.headerCell, widgetStyles.headerCellRight]}>Equity</Text>
            <Text style={[widgetStyles.headerCell, widgetStyles.headerCellRight, { flex: 0.7 }]}>Margin %</Text>
          </View>
          {rows.slice(0, MAX_ROWS).map((row, i) => (
            <View key={`${row.name}-${i}`} style={[widgetStyles.row, i === Math.min(rows.length, MAX_ROWS) - 1 && widgetStyles.rowLast]}>
              <View style={{ flex: 1.4 }}>
                <Text style={widgetStyles.rowLabel} numberOfLines={1}>{row.name}</Text>
                <Text style={widgetStyles.rowSub}>
                  Au {fmtPosition(row.goldPosition)} · Ag {fmtPosition(row.silverPosition)}
                </Text>
              </View>
              <Text
                style={[
                  widgetStyles.rowValue,
                  {
                    flex: 1,
                    textAlign: 'right',
                    color:
                      row.equity > 0
                        ? branding.colors.success
                        : row.equity < 0
                          ? branding.colors.danger
                          : branding.colors.text,
                  },
                ]}
              >
                {fmtSigned(row.equity)}
              </Text>
              <Text style={[widgetStyles.rowValue, { flex: 0.7, textAlign: 'right' }]}>
                {Number.isFinite(row.marginPercent) ? `${row.marginPercent.toFixed(1)}%` : '—'}
              </Text>
            </View>
          ))}
        </>
      )}
    </View>
  )
}
